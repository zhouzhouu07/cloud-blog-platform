package main

import (
"context"
"database/sql"
"errors"
"log"
"net/http"
"os"
"regexp"
"strings"
"time"

"github.com/gin-gonic/gin"
)

type articlePayload struct {
CategoryID *uint64 `json:"category_id"`
Title      string  `json:"title"`
Slug       string  `json:"slug"`
Summary    string  `json:"summary"`
Content    string  `json:"content"`
Status     string  `json:"status"`
}

func adminAuth() gin.HandlerFunc {
expectedToken := os.Getenv("ADMIN_TOKEN")

if expectedToken == "" {
log.Println("warning: ADMIN_TOKEN is empty, admin APIs will reject all requests")
}

return func(c *gin.Context) {
raw := c.GetHeader("Authorization")
token := strings.TrimSpace(strings.TrimPrefix(raw, "Bearer "))

if expectedToken == "" || token == "" || token != expectedToken {
c.JSON(http.StatusUnauthorized, gin.H{
"error": "unauthorized",
})
c.Abort()
return
}

c.Next()
}
}

func (app *application) adminListArticles(c *gin.Context) {
page := positiveInt(c.Query("page"), 1, 100000)
pageSize := positiveInt(c.Query("page_size"), 10, 50)
offset := (page - 1) * pageSize

ctx, cancel := contextWithTimeout(c, 3*time.Second)
defer cancel()

var total int

if err := app.db.QueryRowContext(
ctx,
`SELECT COUNT(*) FROM articles`,
).Scan(&total); err != nil {
serverError(c, err)
return
}

rows, err := app.db.QueryContext(ctx, `
SELECT
a.id,
a.category_id,
c.name,
a.title,
a.slug,
a.summary,
a.status,
a.view_count,
a.published_at,
a.created_at,
a.updated_at
FROM articles AS a
LEFT JOIN categories AS c
ON c.id = a.category_id
ORDER BY a.updated_at DESC, a.id DESC
LIMIT ? OFFSET ?`,
pageSize,
offset,
)
if err != nil {
serverError(c, err)
return
}
defer rows.Close()

items := make([]article, 0)

for rows.Next() {
item, err := scanArticle(rows, false)
if err != nil {
serverError(c, err)
return
}

items = append(items, item)
}

if err := rows.Err(); err != nil {
serverError(c, err)
return
}

c.JSON(http.StatusOK, gin.H{
"items": items,
"pagination": gin.H{
"page":      page,
"page_size": pageSize,
"total":     total,
},
})
}

func (app *application) createArticle(c *gin.Context) {
var payload articlePayload

if err := c.ShouldBindJSON(&payload); err != nil {
c.JSON(http.StatusBadRequest, gin.H{
"error": "invalid json body",
})
return
}

if !validateArticlePayload(c, &payload) {
return
}

ctx, cancel := contextWithTimeout(c, 5*time.Second)
defer cancel()

publishedAt := publishedTime(payload.Status)

result, err := app.db.ExecContext(ctx, `
INSERT INTO articles (
category_id,
title,
slug,
summary,
content,
status,
published_at
)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
payload.CategoryID,
payload.Title,
payload.Slug,
nullString(payload.Summary),
payload.Content,
payload.Status,
publishedAt,
)
if err != nil {
serverError(c, err)
return
}

id, err := result.LastInsertId()
if err != nil {
serverError(c, err)
return
}

_ = app.writeOperationLog(
ctx,
"create",
"article",
uint64(id),
c.ClientIP(),
payload.Title,
)

c.JSON(http.StatusCreated, gin.H{
"id":      id,
"message": "article created",
})
}

func (app *application) updateArticle(c *gin.Context) {
id, ok := parseArticleID(c)
if !ok {
return
}

var payload articlePayload

if err := c.ShouldBindJSON(&payload); err != nil {
c.JSON(http.StatusBadRequest, gin.H{
"error": "invalid json body",
})
return
}

if !validateArticlePayload(c, &payload) {
return
}

ctx, cancel := contextWithTimeout(c, 5*time.Second)
defer cancel()

publishedAt := publishedTime(payload.Status)

result, err := app.db.ExecContext(ctx, `
UPDATE articles
SET
category_id = ?,
title = ?,
slug = ?,
summary = ?,
content = ?,
status = ?,
published_at = ?
WHERE id = ?`,
payload.CategoryID,
payload.Title,
payload.Slug,
nullString(payload.Summary),
payload.Content,
payload.Status,
publishedAt,
id,
)
if err != nil {
serverError(c, err)
return
}

rowsAffected, err := result.RowsAffected()
if err != nil {
serverError(c, err)
return
}

if rowsAffected == 0 {
c.JSON(http.StatusNotFound, gin.H{
"error": "article not found",
})
return
}

_ = app.writeOperationLog(
ctx,
"update",
"article",
id,
c.ClientIP(),
payload.Title,
)

c.JSON(http.StatusOK, gin.H{
"id":      id,
"message": "article updated",
})
}

func (app *application) deleteArticle(c *gin.Context) {
id, ok := parseArticleID(c)
if !ok {
return
}

ctx, cancel := contextWithTimeout(c, 5*time.Second)
defer cancel()

result, err := app.db.ExecContext(
ctx,
`DELETE FROM articles WHERE id = ?`,
id,
)
if err != nil {
serverError(c, err)
return
}

rowsAffected, err := result.RowsAffected()
if err != nil {
serverError(c, err)
return
}

if rowsAffected == 0 {
c.JSON(http.StatusNotFound, gin.H{
"error": "article not found",
})
return
}

_ = app.writeOperationLog(
ctx,
"delete",
"article",
id,
c.ClientIP(),
"",
)

c.JSON(http.StatusOK, gin.H{
"id":      id,
"message": "article deleted",
})
}

func validateArticlePayload(c *gin.Context, payload *articlePayload) bool {
payload.Title = strings.TrimSpace(payload.Title)
payload.Slug = strings.TrimSpace(payload.Slug)
payload.Summary = strings.TrimSpace(payload.Summary)
payload.Content = strings.TrimSpace(payload.Content)
payload.Status = strings.TrimSpace(payload.Status)

if payload.Title == "" {
c.JSON(http.StatusBadRequest, gin.H{
"error": "title is required",
})
return false
}

if payload.Content == "" {
c.JSON(http.StatusBadRequest, gin.H{
"error": "content is required",
})
return false
}

if payload.Status == "" {
payload.Status = "draft"
}

if payload.Status != "draft" && payload.Status != "published" {
c.JSON(http.StatusBadRequest, gin.H{
"error": "status must be draft or published",
})
return false
}

if payload.Slug == "" {
payload.Slug = generateSlug(payload.Title)
}

return true
}

func generateSlug(title string) string {
value := strings.ToLower(strings.TrimSpace(title))

replacer := strings.NewReplacer(
" ", "-",
"_", "-",
"/", "-",
"\\", "-",
":", "-",
".", "-",
",", "-",
"'", "",
"\"", "",
)

value = replacer.Replace(value)

re := regexp.MustCompile(`[^a-z0-9\-]+`)
value = re.ReplaceAllString(value, "")

repeatedDash := regexp.MustCompile(`-+`)
value = repeatedDash.ReplaceAllString(value, "-")

value = strings.Trim(value, "-")

if value == "" {
return "article-" + time.Now().Format("20060102150405")
}

return value
}

func publishedTime(status string) sql.NullTime {
if status == "published" {
return sql.NullTime{
Time:  time.Now(),
Valid: true,
}
}

return sql.NullTime{}
}

func nullString(value string) sql.NullString {
value = strings.TrimSpace(value)

if value == "" {
return sql.NullString{}
}

return sql.NullString{
String: value,
Valid:  true,
}
}

func (app *application) writeOperationLog(
ctx context.Context,
action string,
resource string,
resourceID uint64,
clientIP string,
detail string,
) error {
_, err := app.db.ExecContext(ctx, `
INSERT INTO operation_logs (
action,
resource,
resource_id,
client_ip,
detail
)
VALUES (?, ?, ?, ?, ?)`,
action,
resource,
resourceID,
clientIP,
nullString(detail),
)

if errors.Is(err, sql.ErrNoRows) {
return nil
}

return err
}
