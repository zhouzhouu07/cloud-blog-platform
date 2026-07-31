package main

import (
"context"
"database/sql"
"errors"
"log"
"net/http"
"os"
"os/signal"
"syscall"
"time"

"github.com/gin-gonic/gin"
_ "github.com/go-sql-driver/mysql"
)

const appVersion = "0.1.0"

type application struct {
db *sql.DB
}

func main() {
dsn := os.Getenv("MYSQL_DSN")
if dsn == "" {
log.Fatal("MYSQL_DSN environment variable is required")
}

db, err := sql.Open("mysql", dsn)
if err != nil {
log.Fatalf("open database: %v", err)
}
defer db.Close()

db.SetMaxOpenConns(10)
db.SetMaxIdleConns(5)
db.SetConnMaxIdleTime(2 * time.Minute)
db.SetConnMaxLifetime(5 * time.Minute)

if err := waitForDatabase(db); err != nil {
log.Fatalf("database unavailable: %v", err)
}

app := &application{db: db}

gin.SetMode(gin.ReleaseMode)
router := gin.New()
router.Use(gin.Logger(), gin.Recovery())

router.GET("/healthz", func(c *gin.Context) {
c.JSON(http.StatusOK, gin.H{
"status":  "ok",
"service": "cloud-blog-api",
})
})

api := router.Group("/api")
{
api.GET("/health", app.databaseHealth)
api.GET("/version", func(c *gin.Context) {
c.JSON(http.StatusOK, gin.H{
"service": "cloud-blog-api",
"version": appVersion,
"time":    time.Now().Format(time.RFC3339),
})
})
}

router.NoRoute(func(c *gin.Context) {
c.JSON(http.StatusNotFound, gin.H{
"error": "route not found",
})
})

server := &http.Server{
Addr:              ":8080",
Handler:           router,
ReadHeaderTimeout: 5 * time.Second,
ReadTimeout:       10 * time.Second,
WriteTimeout:      10 * time.Second,
IdleTimeout:       60 * time.Second,
}

go func() {
log.Println("cloud-blog-api listening on :8080")

if err := server.ListenAndServe(); err != nil &&
!errors.Is(err, http.ErrServerClosed) {
log.Fatalf("server error: %v", err)
}
}()

stop := make(chan os.Signal, 1)
signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
<-stop

log.Println("shutting down cloud-blog-api")

ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

if err := server.Shutdown(ctx); err != nil {
log.Printf("graceful shutdown failed: %v", err)
}
}

func waitForDatabase(db *sql.DB) error {
var lastErr error

for attempt := 1; attempt <= 15; attempt++ {
ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
lastErr = db.PingContext(ctx)
cancel()

if lastErr == nil {
log.Println("database connection established")
return nil
}

log.Printf("database connection attempt %d failed: %v", attempt, lastErr)
time.Sleep(2 * time.Second)
}

return lastErr
}

func (app *application) databaseHealth(c *gin.Context) {
ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
defer cancel()

if err := app.db.PingContext(ctx); err != nil {
c.JSON(http.StatusServiceUnavailable, gin.H{
"status":   "error",
"service":  "cloud-blog-api",
"database": "unavailable",
})
return
}

var databaseTime time.Time

if err := app.db.QueryRowContext(
ctx,
"SELECT CURRENT_TIMESTAMP",
).Scan(&databaseTime); err != nil {
c.JSON(http.StatusServiceUnavailable, gin.H{
"status":   "error",
"service":  "cloud-blog-api",
"database": "query failed",
})
return
}

c.JSON(http.StatusOK, gin.H{
"status":        "ok",
"service":       "cloud-blog-api",
"database":      "connected",
"database_time": databaseTime.Format(time.RFC3339),
})
}
