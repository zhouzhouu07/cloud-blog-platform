import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

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

function PublicBlog() {
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
            <a href="/admin">后台管理</a>
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
  const [token, setToken] = useState(localStorage.getItem('cloud_blog_admin_token') || '')
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('请输入管理员 Token 后加载文章。')
  const [loading, setLoading] = useState(false)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

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

  async function loadArticleContent(id) {
    try {
      const data = await requestJson(`/api/articles/${id}`)

      setForm((current) => ({
        ...current,
        content: data.content || current.content || '',
        summary: data.summary || current.summary || ''
      }))
    } catch {
      setMessage('文章正文加载失败，可能该文章不是 published 状态。')
    }
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
    const path = isEdit
      ? `/api/admin/articles/${form.id}`
      : '/api/admin/articles'

    const method = isEdit ? 'PUT' : 'POST'

    try {
      const data = await requestJson(path, {
        method,
        headers: authHeaders,
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

    if (!confirmed) {
      return
    }

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
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>博客后台管理</h1>
          <p>通过管理员 Token 管理文章内容，所有请求均走 Gin API。</p>
        </div>

        <a className="primary-btn" href="/">返回首页</a>
      </header>

      <section className="admin-token-panel">
        <input
          type="password"
          placeholder="请输入 ADMIN_TOKEN"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <button className="primary-btn" onClick={saveToken}>保存 Token</button>
        <button className="ghost-btn" onClick={clearToken}>清除</button>
        <button className="ghost-btn" onClick={loadAdminArticles}>
          {loading ? '加载中...' : '刷新文章'}
        </button>
      </section>

      <div className="admin-message">{message}</div>

      <main className="admin-layout">
        <section className="admin-card">
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
              <button className="primary-btn" type="submit">
                {form.id ? '保存修改' : '新增文章'}
              </button>
              <button className="ghost-btn" type="button" onClick={resetForm}>
                清空表单
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card">
          <h2>文章列表</h2>

          <div className="admin-article-list">
            {articles.length === 0 && (
              <p className="empty">暂无文章，或 Token 未认证。</p>
            )}

            {articles.map((item) => (
              <article className="admin-article-item" key={item.id}>
                <div>
                  <span className="badge">{item.status}</span>
                  <h3>{item.title}</h3>
                  <p>{item.summary || '暂无摘要'}</p>
                  <small>
                    ID：{item.id} · 分类：{item.category_name || '未分类'} · 阅读：{item.view_count}
                  </small>
                </div>

                <div className="admin-item-actions">
                  <button className="ghost-btn" onClick={() => editArticle(item)}>编辑</button>
                  <button className="danger-btn" onClick={() => deleteArticle(item.id)}>删除</button>
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
