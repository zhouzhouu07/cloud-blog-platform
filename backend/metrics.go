package main

import (
"context"
"database/sql"
"fmt"
"net/http"
"strings"
"time"

"github.com/gin-gonic/gin"
)

func (app *application) prometheusMetrics(c *gin.Context) {
ctx, cancel := contextWithTimeout(c, 3*time.Second)
defer cancel()

dbUp := 0.0
articlesTotal := 0.0
articlesPublished := 0.0
articlesDraft := 0.0
categoriesTotal := 0.0
tagsTotal := 0.0

if err := app.db.PingContext(ctx); err == nil {
dbUp = 1
articlesTotal = queryCount(ctx, app.db, `SELECT COUNT(*) FROM articles`)
articlesPublished = queryCount(ctx, app.db, `SELECT COUNT(*) FROM articles WHERE status = 'published'`)
articlesDraft = queryCount(ctx, app.db, `SELECT COUNT(*) FROM articles WHERE status = 'draft'`)
categoriesTotal = queryCount(ctx, app.db, `SELECT COUNT(*) FROM categories`)
tagsTotal = queryCount(ctx, app.db, `SELECT COUNT(*) FROM tags`)
}

var b strings.Builder

writeGauge(&b, "cloud_blog_database_up", "Whether MariaDB is reachable. 1 means up, 0 means down.", dbUp)
writeGauge(&b, "cloud_blog_articles_total", "Total number of articles.", articlesTotal)
writeGauge(&b, "cloud_blog_articles_published", "Total number of published articles.", articlesPublished)
writeGauge(&b, "cloud_blog_articles_draft", "Total number of draft articles.", articlesDraft)
writeGauge(&b, "cloud_blog_categories_total", "Total number of categories.", categoriesTotal)
writeGauge(&b, "cloud_blog_tags_total", "Total number of tags.", tagsTotal)

c.Data(
http.StatusOK,
"text/plain; version=0.0.4; charset=utf-8",
[]byte(b.String()),
)
}

func queryCount(ctx context.Context, db *sql.DB, query string) float64 {
var value float64

if err := db.QueryRowContext(ctx, query).Scan(&value); err != nil {
return 0
}

return value
}

func writeGauge(b *strings.Builder, name string, help string, value float64) {
fmt.Fprintf(b, "# HELP %s %s\n", name, help)
fmt.Fprintf(b, "# TYPE %s gauge\n", name)
fmt.Fprintf(b, "%s %.0f\n", name, value)
}
