import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const DEFAULT_CONFIG = {
  siteTitle: '周晋贤的技术博客',
  homeTitle: '周晋贤的技术博客',
  homeText: '记录生活、学习与技术成长。',
  ownerName: '周晋贤',
  backgroundImage: '',
  avatarImage: '',
  articleImages: [],
  articleImageMap: {}
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
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 10)
}

function useSiteConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  useEffect(() => {
    fetch('/custom/site-config.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('config not found')
        return response.json()
      })
      .then((data) => {
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          articleImages: Array.isArray(data.articleImages) ? data.articleImages : [],
          articleImageMap: data.articleImageMap && typeof data.articleImageMap === 'object'
            ? data.articleImageMap
            : {}
        })
      })
      .catch(() => setConfig(DEFAULT_CONFIG))
  }, [])

  return config
}

function getArticleImage(config, article, index) {
  const map = config.articleImageMap || {}

  if (map[String(article.id)]) {
    return map[String(article.id)]
  }

  if (article.slug && map[article.slug]) {
    return map[article.slug]
  }

  if (config.articleImages && config.articleImages.length > 0) {
    return config.articleImages[index % config.articleImages.length]
  }

  return ''
}

function Layout({ config, children }) {
  const backgroundStyle = config.backgroundImage
    ? { backgroundImage: `url(${config.backgroundImage})` }
    : {}

  return (
    <div className="blog-page" style={backgroundStyle}>
      <div className="page-mask"></div>

      <header className="site-header">
        <div className="site-name">
          <a href="/">{config.siteTitle}</a>
        </div>

        <nav className="site-nav">
          <a href="/">首页</a>
          <a href="/#articles">文章</a>
          <a href="/#categories">分类</a>
          <a href="/#message">留言</a>
          <a href="/admin">后台</a>
        </nav>
      </header>

      {children}

      <footer className="site-footer">
        © {new Date().getFullYear()} {config.siteTitle}
      </footer>
    </div>
  )
}

function HomePage() {
  const config = useSiteConfig()
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [message, setMessage] = useState('')

  async function loadData() {
    try {
      const [articleData, categoryData] = await Promise.all([
        requestJson('/api/articles?page=1&page_size=20'),
        requestJson('/api/categories')
      ])

      setArticles(articleData.items || [])
      setCategories(categoryData.items || [])
      setMessage('')
    } catch (error) {
      setMessage(error.message || '加载失败')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <Layout config={config}>
      <main className="blog-container">
        <section className="home-hero">
          {config.avatarImage && (
            <img className="home-avatar" src={config.avatarImage} alt={config.ownerName} />
          )}

          {!config.avatarImage && (
            <div className="home-avatar text-avatar">
              {String(config.ownerName || '周').slice(0, 1)}
            </div>
          )}

          <h1>{config.homeTitle}</h1>
          <p>{config.homeText}</p>
        </section>

        <section className="content-shell">
          <div className="main-column" id="articles">
            {message && <div className="notice-card">{message}</div>}

            {articles.map((article, index) => {
              const image = getArticleImage(config, article, index)

              return (
                <article className="article-card" key={article.id}>
                  <a className="article-cover" href={`/post/${article.id}`}>
                    {image ? (
                      <img src={image} alt={article.title} />
                    ) : (
                      <div className="default-cover"></div>
                    )}
                  </a>

                  <div className="article-body">
                    <div className="article-meta">
                      <span>{formatDate(article.published_at || article.created_at)}</span>
                      <span>{article.category_name || '未分类'}</span>
                      <span>阅读 {article.view_count || 0}</span>
                    </div>

                    <h2>
                      <a href={`/post/${article.id}`}>{article.title}</a>
                    </h2>

                    <p>{article.summary || '这篇文章暂时没有摘要。'}</p>

                    <a className="read-more" href={`/post/${article.id}`}>
                      继续阅读
                    </a>
                  </div>
                </article>
              )
            })}

            {articles.length === 0 && !message && (
              <div className="notice-card">暂无文章。</div>
            )}
          </div>

          <aside className="side-column">
            <section className="side-card" id="categories">
              <h3>分类</h3>
              <div className="category-list">
                {categories.map((item) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            </section>

            <section className="side-card" id="message">
              <h3>关于本站</h3>
              <p>
                这里用于记录个人学习、生活随笔和技术成长。页面背景、头像和文章封面均可自定义替换。
              </p>
            </section>
          </aside>
        </section>
      </main>
    </Layout>
  )
}

function PostPage() {
  const config = useSiteConfig()
  const postID = window.location.pathname.split('/').filter(Boolean)[1]
  const [article, setArticle] = useState(null)
  const [comments, setComments] = useState([])
  const [form, setForm] = useState({
    nickname: '',
    email: '',
    content: ''
  })
  const [message, setMessage] = useState('')

  async function loadArticle() {
    try {
      const data = await requestJson(`/api/articles/${postID}`)
      setArticle(data)
      setMessage('')
    } catch (error) {
      setMessage(error.message || '文章加载失败')
    }
  }

  async function loadComments() {
    try {
      const data = await requestJson(`/api/articles/${postID}/comments`)
      setComments(data.items || [])
    } catch {
      setComments([])
    }
  }

  async function submitComment(event) {
    event.preventDefault()

    if (!form.nickname.trim() || !form.content.trim()) {
      setMessage('昵称和评论内容不能为空。')
      return
    }

    try {
      const data = await requestJson(`/api/articles/${postID}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      })

      setMessage(data.message || '评论发布成功。')
      setForm({
        nickname: '',
        email: '',
        content: ''
      })
      await loadComments()
    } catch (error) {
      setMessage(error.message || '评论发布失败')
    }
  }

  useEffect(() => {
    loadArticle()
    loadComments()
  }, [postID])

  return (
    <Layout config={config}>
      <main className="post-container">
        {message && <div className="notice-card">{message}</div>}

        {article ? (
          <article className="post-panel">
            <div className="article-meta">
              <span>{formatDate(article.published_at || article.created_at)}</span>
              <span>{article.category_name || '未分类'}</span>
              <span>阅读 {article.view_count || 0}</span>
            </div>

            <h1>{article.title}</h1>
            {article.summary && <p className="post-summary">{article.summary}</p>}

            <div className="post-content">
              {article.content}
            </div>
          </article>
        ) : (
          <div className="notice-card">文章加载中...</div>
        )}

        <section className="comment-panel">
          <h2>评论</h2>

          <form className="comment-form" onSubmit={submitComment}>
            <div className="comment-row">
              <input
                value={form.nickname}
                onChange={(event) => setForm({ ...form, nickname: event.target.value })}
                placeholder="昵称"
              />
              <input
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="邮箱，可不填"
              />
            </div>

            <textarea
              rows="5"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              placeholder="写下你的评论..."
            />

            <button type="submit">发布评论</button>
          </form>

          <div className="comment-list">
            {comments.map((item) => (
              <article className="comment-item" key={item.id}>
                <div>
                  <strong>{item.nickname}</strong>
                  <span>{item.created_at}</span>
                </div>
                <p>{item.content}</p>
              </article>
            ))}

            {comments.length === 0 && (
              <p className="no-comments">暂时还没有评论。</p>
            )}
          </div>
        </section>
      </main>
    </Layout>
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

  async function loadCategories() {
    const data = await requestJson('/api/categories')
    setCategories(data.items || [])
  }

  async function loadAdminArticles() {
    if (!token) {
      setMessage('请先输入管理员 Token。')
      return
    }

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
    }
  }

  async function loadAdminArticleDetail(id) {
    if (!token) {
      setMessage('请先输入管理员 Token。')
      return
    }

    try {
      const data = await requestJson(`/api/admin/articles/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      setForm({
        id: data.id,
        category_id: data.category_id || 1,
        title: data.title || '',
        slug: data.slug || '',
        summary: data.summary || '',
        content: data.content || '',
        status: data.status || 'draft'
      })

      setMessage(`正在编辑文章 #${data.id}`)
    } catch (error) {
      setMessage(error.message || '文章详情加载失败')
    }
  }

  function saveToken() {
    localStorage.setItem('cloud_blog_admin_token', token)
    setMessage('Token 已保存。')
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
      setForm(emptyForm)
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

    if (!window.confirm(`确认删除文章 ID=${id} 吗？`)) {
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
      if (form.id === id) {
        setForm(emptyForm)
      }
      await loadAdminArticles()
    } catch (error) {
      setMessage(error.message)
    }
  }

  useEffect(() => {
    loadCategories().catch(() => setMessage('分类加载失败。'))
    if (token) loadAdminArticles()
  }, [])

  return (
    <Layout config={config}>
      <main className="admin-container">
        <section className="admin-card">
          <h1>后台管理</h1>

          <div className="token-row">
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="ADMIN_TOKEN"
            />
            <button onClick={saveToken}>保存</button>
            <button onClick={loadAdminArticles}>刷新</button>
          </div>

          {message && <p className="admin-message">{message}</p>}
        </section>

        <section className="admin-layout">
          <form className="admin-card admin-form" onSubmit={submitArticle}>
            <h2>{form.id ? `编辑文章 #${form.id}` : '新增文章'}</h2>

            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="标题"
            />

            <input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              placeholder="Slug，例如 linux-note"
            />

            <select
              value={form.category_id || ''}
              onChange={(event) => setForm({ ...form, category_id: event.target.value })}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="published">published</option>
              <option value="draft">draft</option>
            </select>

            <textarea
              rows="3"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              placeholder="摘要"
            />

            <textarea
              rows="14"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              placeholder="正文"
            />

            <div className="admin-actions">
              <button type="submit">保存文章</button>
              <button type="button" onClick={() => setForm(emptyForm)}>清空</button>
            </div>
          </form>

          <section className="admin-card">
            <h2>文章列表</h2>

            {articles.map((item) => (
              <article className="admin-article" key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.summary || '暂无摘要'}</p>
                <div className="admin-article-info">
                  <span>ID：{item.id}</span>
                  <span>{item.status}</span>
                  <span>{item.category_name || '未分类'}</span>
                </div>
                <div className="admin-article-actions">
                  <button type="button" onClick={() => loadAdminArticleDetail(item.id)}>编辑</button>
                  <button type="button" onClick={() => deleteArticle(item.id)}>删除</button>
                </div>
              </article>
            ))}

            {articles.length === 0 && (
              <p className="no-comments">暂无文章，或 Token 未认证。</p>
            )}
          </section>
        </section>
      </main>
    </Layout>
  )
}

function Root() {
  const pathname = window.location.pathname

  if (pathname.startsWith('/admin')) return <AdminPage />
  if (pathname.startsWith('/post/')) return <PostPage />

  return <HomePage />
}

createRoot(document.getElementById('root')).render(<Root />)
