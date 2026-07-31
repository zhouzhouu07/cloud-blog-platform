package main

import (
"net/http"
"strings"
"time"

"github.com/gin-gonic/gin"
)

type comment struct {
ID        uint64 `json:"id"`
ArticleID uint64 `json:"article_id"`
Nickname string `json:"nickname"`
Content   string `json:"content"`
Status    string `json:"status"`
CreatedAt string `json:"created_at"`
}

type commentPayload struct {
Nickname string `json:"nickname"`
Email    string `json:"email"`
Content  string `json:"content"`
}

func (app *application) listComments(c *gin.Context) {
articleID, ok := parseArticleID(c)
if !ok {
return
}

ctx, cancel := contextWithTimeout(c, 3*time.Second)
defer cancel()

rows, err := app.db.QueryContext(ctx, `
SELECT id, article_id, nickname, content, status, created_at
FROM comments
WHERE article_id = ?
  AND status = 'approved'
ORDER BY created_at ASC, id ASC`,
articleID,
)
if err != nil {
serverError(c, err)
return
}
defer rows.Close()

items := make([]comment, 0)

for rows.Next() {
var item comment
var createdAt time.Time

if err := rows.Scan(
&item.ID,
&item.ArticleID,
&item.Nickname,
&item.Content,
&item.Status,
&createdAt,
); err != nil {
serverError(c, err)
return
}

item.CreatedAt = createdAt.Format("2006-01-02 15:04")
items = append(items, item)
}

if err := rows.Err(); err != nil {
serverError(c, err)
return
}

c.JSON(http.StatusOK, gin.H{
"items": items,
})
}

func (app *application) createComment(c *gin.Context) {
articleID, ok := parseArticleID(c)
if !ok {
return
}

var payload commentPayload

if err := c.ShouldBindJSON(&payload); err != nil {
c.JSON(http.StatusBadRequest, gin.H{
"error": "invalid json body",
})
return
}

payload.Nickname = strings.TrimSpace(payload.Nickname)
payload.Email = strings.TrimSpace(payload.Email)
payload.Content = strings.TrimSpace(payload.Content)

if payload.Nickname == "" {
c.JSON(http.StatusBadRequest, gin.H{
"error": "昵称不能为空",
})
return
}

if payload.Content == "" {
c.JSON(http.StatusBadRequest, gin.H{
"error": "评论内容不能为空",
})
return
}

if len([]rune(payload.Nickname)) > 80 {
c.JSON(http.StatusBadRequest, gin.H{
"error": "昵称不能超过80个字符",
})
return
}

if len([]rune(payload.Content)) > 1000 {
c.JSON(http.StatusBadRequest, gin.H{
"error": "评论内容不能超过1000个字符",
})
return
}

ctx, cancel := contextWithTimeout(c, 5*time.Second)
defer cancel()

var exists int
if err := app.db.QueryRowContext(
ctx,
`SELECT COUNT(*) FROM articles WHERE id = ? AND status = 'published'`,
articleID,
).Scan(&exists); err != nil {
serverError(c, err)
return
}

if exists == 0 {
c.JSON(http.StatusNotFound, gin.H{
"error": "文章不存在或尚未发布",
})
return
}

var emailValue any
if payload.Email != "" {
emailValue = payload.Email
}

result, err := app.db.ExecContext(ctx, `
INSERT INTO comments (
article_id,
nickname,
email,
content,
status
)
VALUES (?, ?, ?, ?, 'approved')`,
articleID,
payload.Nickname,
emailValue,
payload.Content,
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

c.JSON(http.StatusCreated, gin.H{
"id":      id,
"message": "评论发布成功",
})
}
