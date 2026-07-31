import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function App() {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('正在加载文章数据...')

  const totalViews = useMemo(() => {
    return articles.reduce((sum, item) => sum + Number(item.view_count || 0), 0)
  }, [articles])

  async function loadHomeData() {
    setLoading(true)
    setMessage('正在加载文章数据...')

    try {
      const [articleRes, categoryRes] = await Promise.all([
        fetch(`${API_BASE}/api/articles?page=1&page_size=10`),
        fetch(`${API_BASE}/api/categories`)
      ])

      if (!articleRes.ok) {
        throw new Error(`文章接口异常：${articleRes.status}`)
      }

      if (!categoryRes.ok) {
        throw new Error(`分类接口异常：${categoryRes.status}`)
      }

      const articleData = await articleRes.json()
      const categoryData = await categoryRes.json()

      const list = articleData.items || []
      setArticles(list)
      setCategories(categoryData.items || [])

      if (list.length > 0) {
        await openArticle(list[0].id, false)
      } else {
        setSelectedArticle(null)
      }

      setMessage('数据加载完成')
    } catch (error) {
      setMessage(error.message || '数据加载失败，请检查后端接口')
    } finally {
      setLoading(false)
    }
  }

  async function openArticle(id, shouldRefreshList = true) {
    try {
      const response = await fetch(`${API_BASE}/api/articles/${id}`)

      if (!response.ok) {
        throw new Error(`文章详情接口异常：${response.status}`)
      }

      const data = await response.json()
      setSelectedArticle(data)

      if (shouldRefreshList) {
        const listResponse = await fetch(`${API_BASE}/api/articles?page=1&page_size=10`)
        const listData = await listResponse.json()
        setArticles(listData.items || [])
      }
    } catch (error) {
      setMessage(error.message || '文章详情加载失败')
    }
  }

  useEffect(() => {
    loadHomeData()
  }, [])

  return (
    <div className="page">
      <header className="hero">
        <nav className="nav">
          <div className="brand">
            <span className="brand-mark">ZJX</span>
            <span>周晋贤的技术博客</span>
          </div>
          <div className="nav-links">
            <a href="#articles">文章</a>
            <a href="#ops">运维能力</a>
            <a href="/api/health" target="_blank" rel="noreferrer">API健康检查</a>
          </div>
        </nav>

        <section className="hero-content">
          <div>
            <p className="eyebrow">Cloud Blog Platform</p>
            <h1>记录 Linux 运维、Docker、数据库与监控告警实践</h1>
            <p className="subtitle">
              本站部署在阿里云 ECS，使用 Docker Compose 编排 Nginx、Gin API 与 MariaDB，
              并通过 GitHub Actions 与阿里云 ACR 完成镜像构建和发布。
            </p>
            <div className="actions">
              <a className="primary-btn" href="#articles">查看文章</a>
              <button className="ghost-btn" onClick={loadHomeData}>刷新数据</button>
            </div>
          </div>

          <div className="status-card">
            <span className={loading ? 'dot loading' : 'dot'}></span>
            <strong>{loading ? '加载中' : '运行正常'}</strong>
            <p>{message}</p>
            <div className="status-grid">
              <div>
                <b>{articles.length}</b>
                <span>文章数量</span>
              </div>
              <div>
                <b>{categories.length}</b>
                <span>分类数量</span>
              </div>
              <div>
                <b>{totalViews}</b>
                <span>总阅读量</span>
              </div>
            </div>
          </div>
        </section>
      </header>

      <main>
        <section className="section" id="ops">
          <div className="section-title">
            <p>Architecture</p>
            <h2>项目架构</h2>
          </div>

          <div className="cards">
            <article className="card">
              <h3>Nginx 前端容器</h3>
              <p>承载 React 静态页面，并将 /api 请求反向代理到后端服务。</p>
            </article>
            <article className="card">
              <h3>Gin API 服务</h3>
              <p>提供文章、分类、健康检查和管理员文章管理接口。</p>
            </article>
            <article className="card">
              <h3>MariaDB 数据库</h3>
              <p>存储文章、分类、标签和后台操作日志，支持持久化数据卷。</p>
            </article>
            <article className="card">
              <h3>CI/CD 发布链路</h3>
              <p>GitHub Actions 构建镜像，推送到阿里云 ACR，服务器拉取运行。</p>
            </article>
          </div>
        </section>

        <section className="section article-layout" id="articles">
          <div className="article-list">
            <div className="section-title">
              <p>Articles</p>
              <h2>最新文章</h2>
            </div>

            {articles.length === 0 && !loading && (
              <div className="empty">暂无文章，请先通过后台接口新增文章。</div>
            )}

            {articles.map((item) => (
              <button
                className={`article-item ${selectedArticle?.id === item.id ? 'active' : ''}`}
                key={item.id}
                onClick={() => openArticle(item.id)}
              >
                <span>{item.category_name || '未分类'}</span>
                <strong>{item.title}</strong>
                <small>{item.summary || '暂无摘要'}</small>
              </button>
            ))}
          </div>

          <article className="article-detail">
            {selectedArticle ? (
              <>
                <span className="badge">{selectedArticle.category_name || '未分类'}</span>
                <h2>{selectedArticle.title}</h2>
                <p className="summary">{selectedArticle.summary}</p>
                <div className="meta">
                  <span>阅读量：{selectedArticle.view_count}</span>
                  <span>状态：{selectedArticle.status}</span>
                </div>
                <pre>{selectedArticle.content}</pre>
              </>
            ) : (
              <div className="empty">请选择左侧文章查看详情。</div>
            )}
          </article>
        </section>
      </main>

      <footer>
        Rocky Linux 8.6 · Docker Compose · Nginx · Gin · MariaDB · Alibaba Cloud ACR
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
