import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const DEFAULT_CONFIG = {
  siteTitle: '周晋贤的技术博客',
  siteSubtitle: 'Linux 运维 · Docker 容器 · 数据库 · 监控告警',
  heroTitle: '记录云服务器、容器化部署与自动化运维实践',
  heroText:
    '本站基于 React、Gin、MariaDB、Nginx、Docker Compose、Prometheus、Grafana 和 Alertmanager 构建，用于记录个人技术学习与运维项目实践。',
  ownerName: '周晋贤',
  ownerRole: '通信工程本科 · 运维方向学习者',
  heroImage: '',
  avatarImage: '',
  galleryImages: []
}

function requestJson(path, options = {}) {
  return fetch(`${API_BASE}${path}`, options).then(async (response) => {
    const text = await response.text()
    const data = text ? JSON.parse(text) : {}

    if (!response.ok) {
      throw new Error(data.error || `请求失败：${response.status}`)
    }

    return data
  })
}

function formatDate(value) {
  if (!value) return '未发布'
  return String(value).replace('T', ' ').slice(0, 16)
}

function useSiteConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  useEffect(() => {
    fetch('/custom/site-config.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('site config not found')
        }
        return response.json()
      })
      .then((data) => {
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages : []
        })
      })
      .catch(() => {
        setConfig(DEFAULT_CONFIG)
      })
  }, [])

  return config
}

function PublicBlog() {
  const config = useSiteConfig()
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
      const [articleData, categoryData] = await Promise.all([
        requestJson('/api/articles?page=1&page_size=10'),
        requestJson('/api/categories')
      ])

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
      const data = await requestJson(`/api/articles/${id}`)
      setSelectedArticle(data)

      if (shouldRefreshList) {
        const listData = await requestJson('/api/articles?page=1&page_size=10')
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
    <div className="site-shell">
      <div className="background-blur background-blur-a"></div>
      <div className="background-blur background-blur-b"></div>

      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-logo">Z</span>
          <span>
            <strong>{config.siteTitle}</strong>
            <small>{config.siteSubtitle}</small>
          </span>
        </a>

        <nav className="nav-links">
          <a href="#home">首页</a>
          <a href="#articles">文章</a>
          <a href="#ops">运维能力</a>
          <a href="/admin">后台管理</a>
          <a href="/api/health" target="_blank" rel="noreferrer">API</a>
        </nav>
      </header>

      <main id="home">
        <section className="hero-card">
          <div className="hero-copy">
            <p className="kicker">Cloud Native Blog</p>
            <h1>{config.heroTitle}</h1>
            <p className="hero-desc">{config.heroText}</p>

            <div className="hero-actions">
              <a className="btn btn-primary" href="#articles">开始阅读</a>
              <button className="btn btn-soft" onClick={loadHomeData}>刷新数据</button>
            </div>

            <div className="hero-metrics">
              <div>
                <strong>{articles.length}</strong>
                <span>文章</span>
              </div>
              <div>
                <strong>{categories.length}</strong>
                <span>分类</span>
              </div>
              <div>
                <strong>{totalViews}</strong>
                <span>阅读</span>
              </div>
            </div>
          </div>

          <aside className="profile-card">
            <div className="profile-cover">
              {config.heroImage ? (
                <img src={config.heroImage} alt="博客封面" />
              ) : (
                <div className="default-cover">
                  <span>Cloud</span>
                  <span>Blog</span>
                </div>
              )}
            </div>

            <div className="profile-body">
              <div className="avatar">
                {config.avatarImage ? (
                  <img src={config.avatarImage} alt={config.ownerName} />
                ) : (
                  <span>周</span>
                )}
              </div>

              <h2>{config.ownerName}</h2>
              <p>{config.ownerRole}</p>

              <div className="status-pill">
                <span className={loading ? 'pulse-dot loading' : 'pulse-dot'}></span>
                {message}
              </div>
            </div>
          </aside>
        </section>

        <section className="section" id="ops">
          <div className="section-heading">
            <p>Operations Capability</p>
            <h2>项目运维能力</h2>
          </div>

          <div className="ops-grid">
            <article className="ops-card">
              <span>01</span>
              <h3>容器化部署</h3>
              <p>使用 Docker Compose 编排 React、Nginx、Gin API、MariaDB、Prometheus、Grafana 等服务。</p>
            </article>
            <article className="ops-card">
              <span>02</span>
              <h3>CI/CD 流水线</h3>
              <p>通过 GitHub Actions 构建前后端镜像，推送至阿里云 ACR，并支持远程部署到 ECS。</p>
            </article>
            <article className="ops-card">
              <span>03</span>
              <h3>备份与恢复</h3>
              <p>编写 MariaDB 自动备份、恢复和校验脚本，支持误删数据恢复演练。</p>
            </article>
            <article className="ops-card">
              <span>04</span>
              <h3>监控告警</h3>
              <p>接入 Prometheus、Grafana、Alertmanager，实现主机、容器、数据库和业务指标告警。</p>
            </article>
          </div>
        </section>

        <section className="section content-layout" id="articles">
          <div className="article-column">
            <div className="section-heading">
              <p>Latest Posts</p>
              <h2>最新文章</h2>
            </div>

            <div className="article-feed">
              {articles.length === 0 && !loading && (
                <div className="empty-card">暂无文章，请进入后台新增文章。</div>
              )}

              {articles.map((item) => (
                <button
                  key={item.id}
                  className={`post-card ${selectedArticle?.id === item.id ? 'active' : ''}`}
                  onClick={() => openArticle(item.id)}
                >
                  <div className="post-meta">
                    <span>{item.category_name || '未分类'}</span>
                    <span>{formatDate(item.published_at || item.created_at)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary || '暂无摘要'}</p>
                  <div className="read-row">
                    <small>阅读量：{item.view_count}</small>
                    <em>阅读全文 →</em>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <aside className="side-column">
            <div className="glass-card">
              <h3>分类</h3>
              <div className="tag-list">
                {categories.map((item) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <h3>图片展示</h3>
              <div className="gallery">
                {config.galleryImages.length > 0 ? (
                  config.galleryImages.slice(0, 6).map((src, index) => (
                    <img key={src + index} src={src} alt={`展示图 ${index + 1}`} />
                  ))
                ) : (
                  <>
                    <div className="gallery-placeholder">Docker</div>
                    <div className="gallery-placeholder">Linux</div>
                    <div className="gallery-placeholder">Grafana</div>
                    <div className="gallery-placeholder">CI/CD</div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </section>

        <section className="section">
          <article className="reader-card">
            {selectedArticle ? (
              <>
                <div className="reader-meta">
                  <span>{selectedArticle.category_name || '未分类'}</span>
                  <span>阅读量：{selectedArticle.view_count}</span>
                  <span>状态：{selectedArticle.status}</span>
                </div>
                <h2>{selectedArticle.title}</h2>
                <p className="reader-summary">{selectedArticle.summary}</p>
                <pre>{selectedArticle.content}</pre>
              </>
            ) : (
              <div className="empty-card">请选择一篇文章查看详情。</div>
            )}
          </article>
        </section>
      </main>

      <footer className="footer">
        <span>Rocky Linux 8.6</span>
        <span>Docker Compose</span>
        <span>React + Gin + MariaDB</span>
        <span>Prometheus + Grafana + Alertmanager</span>
      </footer>
    </div>
  )
}

const emptyForm = {
  id: null,
  category_id: 1,
  title: '',
  slug: '',
  summary: '',
  content: '',
  status: 'published'
}

function AdminPage() {
  const config = useSiteConfig()
  const [token, setToken] = useState(localStorage.getItem('cloud_blog_admin_token') || '')
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('请输入管理员 Token 后加载文章。')
  const [loading, setLoading] = useState(false)

  function saveToken() {
    localStorage.setItem('cloud_blog_admin_token', token)
    setMessage('Token 已保存到浏览器本地。')
  }

  function clearToken() {
    localStorage.removeItem('cloud_blog_admin_token')
    setToken('')
    setMessage('Token 已清除。')
  }

  async function loadCategories() {
    const data = await requestJson('/api/categories')
    setCategories(data.items || [])
  }

  async function loadAdminArticles() {
    if (!token) {
      setMessage('请先输入管理员 Token。')
      return
    }

    setLoading(true)

    try {
      const data = await requestJson('/api/admin/articles?page=1&page_size=50', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      setArticles(data.items || [])
      setMessage('文章列表加载成功。')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadArticleContent(id) {
    try {
      const data = await requestJson(`/api/articles/${id}`)

      setForm((current) => ({
        ...current,
        content: data.content || current.content || '',
        summary: data.summary || current.summary || ''
      }))
    } catch {
      setMessage('文章正文加载失败，草稿文章可能无法通过公开详情接口读取。')
    }
  }

  function editArticle(item) {
    setForm({
      id: item.id,
      category_id: item.category_id || 1,
      title: item.title || '',
      slug: item.slug || '',
      summary: item.summary || '',
      content: item.content || '',
      status: item.status || 'draft'
    })

    loadArticleContent(item.id)
  }

  function resetForm() {
    setForm(emptyForm)
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }))
  }

  async function submitArticle(event) {
    event.preventDefault()

    if (!token) {
      setMessage('请先输入管理员 Token。')
      return
    }

    if (!form.title.trim() || !form.content.trim()) {
      setMessage('标题和正文不能为空。')
      return
    }

    const payload = {
      category_id: Number(form.category_id) || null,
      title: form.title,
      slug: form.slug,
      summary: form.summary,
      content: form.content,
      status: form.status
    }

    const isEdit = Boolean(form.id)
    const path = isEdit ? `/api/admin/articles/${form.id}` : '/api/admin/articles'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const data = await requestJson(path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      setMessage(data.message || '保存成功。')
      resetForm()
      await loadAdminArticles()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function deleteArticle(id) {
    if (!token) {
      setMessage('请先输入管理员 Token。')
      return
    }

    const confirmed = window.confirm(`确认删除文章 ID=${id} 吗？`)
    if (!confirmed) return

    try {
      const data = await requestJson(`/api/admin/articles/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      setMessage(data.message || '删除成功。')
      await loadAdminArticles()
    } catch (error) {
      setMessage(error.message)
    }
  }

  useEffect(() => {
    loadCategories().catch(() => {
      setMessage('分类加载失败。')
    })

    if (token) {
      loadAdminArticles()
    }
  }, [])

  return (
    <div className="admin-shell">
      <div className="background-blur background-blur-a"></div>
      <div className="background-blur background-blur-b"></div>

      <header className="admin-hero">
        <div>
          <p className="kicker">Admin Console</p>
          <h1>{config.siteTitle} 后台管理</h1>
          <p>管理文章内容、发布状态和分类归属，所有写操作均通过管理员 Token 认证。</p>
        </div>
        <a className="btn btn-primary" href="/">返回首页</a>
      </header>

      <section className="admin-token-card">
        <input
          type="password"
          placeholder="请输入 ADMIN_TOKEN"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <button className="btn btn-primary" onClick={saveToken}>保存 Token</button>
        <button className="btn btn-soft" onClick={clearToken}>清除</button>
        <button className="btn btn-soft" onClick={loadAdminArticles}>
          {loading ? '加载中...' : '刷新文章'}
        </button>
      </section>

      <div className="admin-message">{message}</div>

      <main className="admin-layout">
        <section className="admin-panel">
          <h2>{form.id ? `编辑文章 #${form.id}` : '新增文章'}</h2>

          <form className="admin-form" onSubmit={submitArticle}>
            <label>
              标题
              <input
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="文章标题"
              />
            </label>

            <label>
              Slug
              <input
                value={form.slug}
                onChange={(event) => updateField('slug', event.target.value)}
                placeholder="例如 docker-compose-cloud-blog"
              />
            </label>

            <div className="form-row">
              <label>
                分类
                <select
                  value={form.category_id || ''}
                  onChange={(event) => updateField('category_id', event.target.value)}
                >
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                状态
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  <option value="published">published</option>
                  <option value="draft">draft</option>
                </select>
              </label>
            </div>

            <label>
              摘要
              <textarea
                rows="3"
                value={form.summary}
                onChange={(event) => updateField('summary', event.target.value)}
                placeholder="文章摘要"
              />
            </label>

            <label>
              正文
              <textarea
                rows="14"
                value={form.content}
                onChange={(event) => updateField('content', event.target.value)}
                placeholder="支持 Markdown 文本，当前页面以纯文本展示。"
              />
            </label>

            <div className="admin-actions">
              <button className="btn btn-primary" type="submit">
                {form.id ? '保存修改' : '新增文章'}
              </button>
              <button className="btn btn-soft" type="button" onClick={resetForm}>
                清空表单
              </button>
            </div>
          </form>
        </section>

        <section className="admin-panel">
          <h2>文章列表</h2>

          <div className="admin-list">
            {articles.length === 0 && (
              <p className="empty-card">暂无文章，或 Token 未认证。</p>
            )}

            {articles.map((item) => (
              <article className="admin-item" key={item.id}>
                <div>
                  <div className="post-meta">
                    <span>{item.status}</span>
                    <span>ID：{item.id}</span>
                    <span>{item.category_name || '未分类'}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary || '暂无摘要'}</p>
                  <small>阅读量：{item.view_count}</small>
                </div>

                <div className="admin-item-actions">
                  <button className="btn btn-soft" onClick={() => editArticle(item)}>编辑</button>
                  <button className="btn btn-danger" onClick={() => deleteArticle(item.id)}>删除</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function Root() {
  const pathname = window.location.pathname

  if (pathname.startsWith('/admin')) {
    return <AdminPage />
  }

  return <PublicBlog />
}

createRoot(document.getElementById('root')).render(<Root />)
