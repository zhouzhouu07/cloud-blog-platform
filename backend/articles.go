package main

import (
"context"
"database/sql"
"errors"
"log"
"net/http"
"strconv"
"time"

"github.com/gin-gonic/gin"
)

type article struct {
ID           uint64     `json:"id"`
CategoryID   *uint64    `json:"category_id"`
CategoryName *string    `json:"category_name"`
Title        string     `json:"title"`
Slug         string     `json:"slug"`
Summary      *string    `json:"summary"`
Content      string     `json:"content,omitempty"`
Status       string     `json:"status"`
ViewCount    uint64     `json:"view_count"`
PublishedAt  *time.Time `json:"published_at"`
CreatedAt    time.Time  `json:"created_at"`
UpdatedAt    time.Time  `json:"updated_at"`
}

type rowScanner interface {
Scan(dest ...any) error
}

func (app *application) listArticles(c *gin.Context) {
page := positiveInt(c.Query("page"), 1, 100000)
pageSize := positiveInt(c.Query("page_size"), 10, 50)
offset := (page - 1) * pageSize

ctx, cancel := contextWithTimeout(c, 3*time.Second)
defer cancel()

var total int

if err := app.db.QueryRowContext(
ctx,
`SELECT COUNT(*) FROM articles WHERE status = 'published'`,
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
WHERE a.status = 'published'
ORDER BY
COALESCE(a.published_at, a.created_at) DESC,
a.id DESC
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

func (app *application) getArticle(c *gin.Context) {
id, ok := parseArticleID(c)
if !ok {
return
}

ctx, cancel := contextWithTimeout(c, 3*time.Second)
defer cancel()

item, err := scanArticle(
app.db.QueryRowContext(ctx, `
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
a.updated_at,
a.content
FROM articles AS a
LEFT JOIN categories AS c
ON c.id = a.category_id
WHERE a.id = ?
  AND a.status = 'published'`,
id,
),
true,
)

if errors.Is(err, sql.ErrNoRows) {
c.JSON(http.StatusNotFound, gin.H{
"error": "article not found",
})
return
}

if err != nil {
serverError(c, err)
return
}

if _, err := app.db.ExecContext(
ctx,
`UPDATE articles
 SET view_count = view_count + 1
 WHERE id = ?`,
id,
); err == nil {
item.ViewCount++
}

c.JSON(http.StatusOK, item)
}

func (app *application) listCategories(c *gin.Context) {
ctx, cancel := contextWithTimeout(c, 3*time.Second)
defer cancel()

rows, err := app.db.QueryContext(
ctx,
`SELECT id, name, slug
 FROM categories
 ORDER BY id`,
)
if err != nil {
serverError(c, err)
return
}
defer rows.Close()

items := make([]gin.H, 0)

for rows.Next() {
var id uint64
var name string
var slug string

if err := rows.Scan(&id, &name, &slug); err != nil {
serverError(c, err)
return
}

items = append(items, gin.H{
"id":   id,
"name": name,
"slug": slug,
})
}

if err := rows.Err(); err != nil {
serverError(c, err)
return
}

c.JSON(http.StatusOK, gin.H{
"items": items,
})
}

func scanArticle(
scanner rowScanner,
withContent bool,
) (article, error) {
var item article

var categoryID sql.NullInt64
var categoryName sql.NullString
var summary sql.NullString
var publishedAt sql.NullTime

dest := []any{
&item.ID,
&categoryID,
&categoryName,
&item.Title,
&item.Slug,
&summary,
&item.Status,
&item.ViewCount,
&publishedAt,
&item.CreatedAt,
&item.UpdatedAt,
}

if withContent {
dest = append(dest, &item.Content)
}

if err := scanner.Scan(dest...); err != nil {
return item, err
}

if categoryID.Valid {
value := uint64(categoryID.Int64)
item.CategoryID = &value
}

if categoryName.Valid {
value := categoryName.String
item.CategoryName = &value
}

if summary.Valid {
value := summary.String
item.Summary = &value
}

if publishedAt.Valid {
value := publishedAt.Time
item.PublishedAt = &value
}

return item, nil
}

func parseArticleID(c *gin.Context) (uint64, bool) {
id, err := strconv.ParseUint(c.Param("id"), 10, 64)

if err != nil || id == 0 {
c.JSON(http.StatusBadRequest, gin.H{
"error": "invalid article id",
})
return 0, false
}

return id, true
}

func positiveInt(
raw string,
fallback int,
maximum int,
) int {
value, err := strconv.Atoi(raw)

if raw == "" || err != nil || value < 1 {
return fallback
}

if value > maximum {
return maximum
}

return value
}

func contextWithTimeout(
c *gin.Context,
timeout time.Duration,
) (context.Context, context.CancelFunc) {
return context.WithTimeout(
c.Request.Context(),
timeout,
)
}

func serverError(c *gin.Context, err error) {
log.Printf("request failed: %v", err)

c.JSON(http.StatusInternalServerError, gin.H{
"error": "internal server error",
})
}
