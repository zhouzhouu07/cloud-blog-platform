package main

import (
"net/http"
"strconv"
"strings"
"time"

"github.com/gin-gonic/gin"
)

type categoryPayload struct {
Name string `json:"name"`
Slug string `json:"slug"`
}

func parseUintParam(c *gin.Context, name string) (uint64, bool) {
raw := strings.TrimSpace(c.Param(name))

id, err := strconv.ParseUint(raw, 10, 64)
if err != nil || id == 0 {
c.JSON(http.StatusBadRequest, gin.H{
"error": "invalid id",
})
return 0, false
}

return id, true
}

func makeCategorySlug(slug string, name string) string {
source := strings.TrimSpace(slug)
if source == "" {
source = strings.TrimSpace(name)
}

source = strings.ToLower(source)

var builder strings.Builder
lastDash := false

for _, r := range source {
if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
builder.WriteRune(r)
lastDash = false
continue
}

if r == '-' || r == '_' || r == ' ' {
if !lastDash {
builder.WriteByte('-')
lastDash = true
}
}
}

result := strings.Trim(builder.String(), "-")
if result == "" {
result = "category-" + strconv.FormatInt(time.Now().UnixNano(), 10)
}

return result
}

func (app *application) adminListCategories(c *gin.Context) {
ctx, cancel := contextWithTimeout(c, 3*time.Second)
defer cancel()

rows, err := app.db.QueryContext(ctx, `
SELECT
c.id,
c.name,
c.slug,
COUNT(a.id) AS article_count
FROM categories c
LEFT JOIN articles a ON a.category_id = c.id
GROUP BY c.id, c.name, c.slug
ORDER BY c.id DESC`)
if err != nil {
serverError(c, err)
return
}
defer rows.Close()

items := make([]gin.H, 0)

for rows.Next() {
var (
id           uint64
name         string
slug         string
articleCount uint64
)

if err := rows.Scan(&id, &name, &slug, &articleCount); err != nil {
serverError(c, err)
return
}

items = append(items, gin.H{
"id":            id,
"name":          name,
"slug":          slug,
"article_count": articleCount,
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

func (app *application) adminCreateCategory(c *gin.Context) {
var payload categoryPayload

if err := c.ShouldBindJSON(&payload); err != nil {
c.JSON(http.StatusBadRequest, gin.H{
"error": "invalid json body",
})
return
}

payload.Name = strings.TrimSpace(payload.Name)
payload.Slug = makeCategorySlug(payload.Slug, payload.Name)

if payload.Name == "" {
c.JSON(http.StatusBadRequest, gin.H{
"error": "分类名称不能为空",
})
return
}

ctx, cancel := contextWithTimeout(c, 5*time.Second)
defer cancel()

result, err := app.db.ExecContext(ctx, `
INSERT INTO categories (name, slug)
VALUES (?, ?)`,
payload.Name,
payload.Slug)
if err != nil {
serverError(c, err)
return
}

id, err := result.LastInsertId()
if err != nil {
serverError(c, err)
return
}

c.JSON(http.StatusCreated, gin.H{
"id":      id,
"message": "分类创建成功",
})
}

func (app *application) adminUpdateCategory(c *gin.Context) {
categoryID, ok := parseUintParam(c, "id")
if !ok {
return
}

var payload categoryPayload

if err := c.ShouldBindJSON(&payload); err != nil {
c.JSON(http.StatusBadRequest, gin.H{
"error": "invalid json body",
})
return
}

payload.Name = strings.TrimSpace(payload.Name)
payload.Slug = makeCategorySlug(payload.Slug, payload.Name)

if payload.Name == "" {
c.JSON(http.StatusBadRequest, gin.H{
"error": "分类名称不能为空",
})
return
}

ctx, cancel := contextWithTimeout(c, 5*time.Second)
defer cancel()

result, err := app.db.ExecContext(ctx, `
UPDATE categories
SET name = ?, slug = ?
WHERE id = ?`,
payload.Name,
payload.Slug,
categoryID)
if err != nil {
serverError(c, err)
return
}

affected, err := result.RowsAffected()
if err != nil {
serverError(c, err)
return
}

if affected == 0 {
c.JSON(http.StatusNotFound, gin.H{
"error": "分类不存在",
})
return
}

c.JSON(http.StatusOK, gin.H{
"message": "分类修改成功",
})
}

func (app *application) adminDeleteCategory(c *gin.Context) {
categoryID, ok := parseUintParam(c, "id")
if !ok {
return
}

ctx, cancel := contextWithTimeout(c, 5*time.Second)
defer cancel()

var articleCount int

if err := app.db.QueryRowContext(ctx,
`SELECT COUNT(*) FROM articles WHERE category_id = ?`,
categoryID).Scan(&articleCount); err != nil {
serverError(c, err)
return
}

if articleCount > 0 {
c.JSON(http.StatusConflict, gin.H{
"error": "该分类下还有文章，请先修改文章分类后再删除",
})
return
}

result, err := app.db.ExecContext(ctx,
`DELETE FROM categories WHERE id = ?`,
categoryID)
if err != nil {
serverError(c, err)
return
}

affected, err := result.RowsAffected()
if err != nil {
serverError(c, err)
return
}

if affected == 0 {
c.JSON(http.StatusNotFound, gin.H{
"error": "分类不存在",
})
return
}

c.JSON(http.StatusOK, gin.H{
"message": "分类删除成功",
})
}
