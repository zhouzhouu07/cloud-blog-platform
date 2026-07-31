package main

import (
"database/sql"
"net/http"
"time"

"github.com/gin-gonic/gin"
)

func (app *application) adminGetArticle(c *gin.Context) {
articleID, ok := parseArticleID(c)
if !ok {
return
}

ctx, cancel := contextWithTimeout(c, 5*time.Second)
defer cancel()

var (
id           uint64
categoryID   sql.NullInt64
categoryName sql.NullString
title        string
slug         string
summary      sql.NullString
content      sql.NullString
status       string
viewCount    uint64
publishedAt  sql.NullTime
createdAt    time.Time
updatedAt    time.Time
)

err := app.db.QueryRowContext(ctx, `
SELECT
a.id,
a.category_id,
c.name AS category_name,
a.title,
a.slug,
a.summary,
a.content,
a.status,
a.view_count,
a.published_at,
a.created_at,
a.updated_at
FROM articles a
LEFT JOIN categories c ON a.category_id = c.id
WHERE a.id = ?`,
articleID,
).Scan(
&id,
&categoryID,
&categoryName,
&title,
&slug,
&summary,
&content,
&status,
&viewCount,
&publishedAt,
&createdAt,
&updatedAt,
)

if err == sql.ErrNoRows {
c.JSON(http.StatusNotFound, gin.H{
"error": "文章不存在",
})
return
}

if err != nil {
serverError(c, err)
return
}

response := gin.H{
"id":         id,
"title":      title,
"slug":       slug,
"summary":    summary.String,
"content":    content.String,
"status":     status,
"view_count": viewCount,
"created_at": createdAt.Format("2006-01-02 15:04:05"),
"updated_at": updatedAt.Format("2006-01-02 15:04:05"),
}

if categoryID.Valid {
response["category_id"] = categoryID.Int64
} else {
response["category_id"] = nil
}

if categoryName.Valid {
response["category_name"] = categoryName.String
} else {
response["category_name"] = ""
}

if publishedAt.Valid {
response["published_at"] = publishedAt.Time.Format("2006-01-02 15:04:05")
} else {
response["published_at"] = nil
}

c.JSON(http.StatusOK, response)
}
