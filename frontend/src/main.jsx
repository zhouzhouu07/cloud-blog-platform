import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const DEFAULT_CONFIG = {
  siteTitle: '周周的技术博客',
  homeTitle: '周周的技术博客',
  homeText: '记录生活、学习与技术成长。',
  ownerName: '周周',
  avatarImage: '/custom/images/avatar.jpg',
  articleImages: [],
  articleImageMap: {}
}

const emptyArticleForm = {
  id: null,
  category_id: '',
  title: '',
  slug: '',
  summary: '',
  content: '',
  status: 'published'
}

const emptyCategoryForm = {
  id: null,
  name: '',
  slug: ''
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

  if (map[String(article.id)]) return map[String(article.id)]
  if (article.slug && map[article.slug]) return map[article.slug]

  const customImages = Array.isArray(config.articleImages)
    ? config.articleImages.filter(Boolean)
    : []

  if (customImages.length > 0) {
    return customImages[index % customImages.length]
  }

  const seed = encodeURIComponent(String(article.slug || article.id || index || 'blog'))
  return `https://picsum.photos/seed/cloud-blog-${seed}/900/650`
}

function Avatar({ config }) {
  const [failed, setFailed] = useState(false)
  const first = String(config.ownerName || '周').slice(0, 1)

  if (config.avatarImage && !failed) {
    return (
      <img
        className="home-avatar"
        src={`${config.avatarImage}?v=${Date.now()}`}
        alt={config.ownerName}
        onError={() => setFailed(true)}
      />
    )
  }

  return <div className="home-avatar text-avatar">{first}</div>
}

function getOpsUrls() {
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  const host = window.location.hostname

  return {
    grafana: `${protocol}//${host}:3000`,
    prometheus: `${protocol}//${host}:9090`
  }
}

function Layout({ config, children }) {
  const backgroundStyle = {
    backgroundImage:
      `linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0.12)), url('/custom/images/background.jpg?v=${Date.now()}')`
  }

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
  const [selectedCategoryID, setSelectedCategoryID] = useState('all')
  const [message, setMessage] = useState('')

  async function loadData() {
    try {
      const [articleData, categoryData] = await Promise.all([
        requestJson('/api/articles?page=1&page_size=50'),
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

  const filteredArticles = useMemo(() => {
    if (selectedCategoryID === 'all') return articles

    return articles.filter((article) => {
      return String(article.category_id || '') === String(selectedCategoryID)
    })
  }, [articles, selectedCategoryID])

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryID === 'all') return '全部文章'
    const current = categories.find((item) => String(item.id) === String(selectedCategoryID))
    return current ? current.name : '当前分类'
  }, [categories, selectedCategoryID])

  return (
    <Layout config={config}>
      <main className="blog-container">
        <section className="home-hero">
          <Avatar config={config} />
          <h1>{config.homeTitle}</h1>
          <p>{config.homeText}</p>
        </section>

        <section className="content-shell">
          <div className="main-column" id="articles">
            <div className="category-title-card">
              <span>当前分类</span>
              <strong>{selectedCategoryName}</strong>
            </div>

            {message && <div className="notice-card">{message}</div>}

            {filteredArticles.map((article, index) => {
              const image = getArticleImage(config, article, index)

              return (
                <article className="article-card" key={article.id}>
                  <a className="article-cover" href={`/post/${article.id}`}>
                    <img src={image} alt={article.title} />
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

            {filteredArticles.length === 0 && !message && (
              <div className="notice-card">
                当前分类下暂无文章。
              </div>
            )}
          </div>

          <aside className="side-column">
            <section className="side-card" id="categories">
              <h3>分类</h3>

              <div className="category-vertical-list">
                <button
                  type="button"
                  className={selectedCategoryID === 'all' ? 'active' : ''}
                  onClick={() => setSelectedCategoryID('all')}
                >
                  <span>全部文章</span>
                  <em>{articles.length}</em>
                </button>

                {categories.map((item) => {
                  const count = articles.filter((article) => {
                    return String(article.category_id || '') === String(item.id)
                  }).length

                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={String(selectedCategoryID) === String(item.id) ? 'active' : ''}
                      onClick={() => setSelectedCategoryID(item.id)}
                    >
                      <span>{item.name}</span>
                      <em>{count}</em>
                    </button>
                  )
                })}

                {categories.length === 0 && (
                  <p className="category-empty">
                    暂无分类，请到后台添加。
                  </p>
                )}
              </div>
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
  const [form, setForm] = useState({ nickname: '', email: '', content: '' })
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      setMessage(data.message || '评论发布成功。')
      setForm({ nickname: '', email: '', content: '' })
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

            <div className="post-content">{article.content}</div>
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

            {comments.length === 0 && <p className="no-comments">暂时还没有评论。</p>}
          </div>
        </section>
      </main>
    </Layout>
  )
}

function AdminPage() {
  const config = useSiteConfig()
  const opsUrls = getOpsUrls()

  const [token, setToken] = useState(localStorage.getItem('cloud_blog_admin_token') || '')
  const [isAdminVerified, setIsAdminVerified] = useState(false)

  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [articleForm, setArticleForm] = useState(emptyArticleForm)
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
  const [message, setMessage] = useState('请输入管理员 Token 后加载文章。')

  async function loadPublicCategories() {
    const data = await requestJson('/api/categories')
    setCategories(data.items || [])
  }

  async function loadAdminCategories() {
    if (!token) return

    const data = await requestJson('/api/admin/categories', {
      headers: { Authorization: `Bearer ${token}` }
    })

    setCategories(data.items || [])
  }

  async function loadAdminArticles() {
    if (!token) {
      setMessage('请先输入管理员 Token。')
      return
    }

    try {
      const data = await requestJson('/api/admin/articles?page=1&page_size=50', {
        headers: { Authorization: `Bearer ${token}` }
      })

      setArticles(data.items || [])
      setIsAdminVerified(true)
      setMessage('管理员权限验证成功。')

      await loadAdminCategories()
    } catch (error) {
      setIsAdminVerified(false)
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
        headers: { Authorization: `Bearer ${token}` }
      })

      setArticleForm({
        id: data.id,
        category_id: data.category_id || '',
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
    setMessage('Token 已保存，请点击验证/刷新。')
  }

  async function submitArticle(event) {
    event.preventDefault()

    if (!token) {
      setMessage('请先输入管理员 Token。')
      return
    }

    if (!articleForm.title.trim() || !articleForm.content.trim()) {
      setMessage('标题和正文不能为空。')
      return
    }

    const payload = {
      category_id: Number(articleForm.category_id) || null,
      title: articleForm.title,
      slug: articleForm.slug,
      summary: articleForm.summary,
      content: articleForm.content,
      status: articleForm.status
    }

    const isEdit = Boolean(articleForm.id)
    const path = isEdit ? `/api/admin/articles/${articleForm.id}` : '/api/admin/articles'
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

      setMessage(data.message || '文章保存成功。')
      setArticleForm(emptyArticleForm)
      await loadAdminArticles()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function deleteArticle(id) {
    if (!window.confirm(`确认删除文章 ID=${id} 吗？`)) return

    try {
      const data = await requestJson(`/api/admin/articles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      setMessage(data.message || '文章删除成功。')
      if (articleForm.id === id) setArticleForm(emptyArticleForm)
      await loadAdminArticles()
    } catch (error) {
      setMessage(error.message)
    }
  }

  function editCategory(item) {
    setCategoryForm({
      id: item.id,
      name: item.name || '',
      slug: item.slug || ''
    })
  }

  async function submitCategory(event) {
    event.preventDefault()

    if (!token) {
      setMessage('请先输入管理员 Token。')
      return
    }

    if (!categoryForm.name.trim()) {
      setMessage('分类名称不能为空。')
      return
    }

    const isEdit = Boolean(categoryForm.id)
    const path = isEdit
      ? `/api/admin/categories/${categoryForm.id}`
      : '/api/admin/categories'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const data = await requestJson(path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: categoryForm.name,
          slug: categoryForm.slug
        })
      })

      setMessage(data.message || '分类保存成功。')
      setCategoryForm(emptyCategoryForm)
      await loadAdminCategories()
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function deleteCategory(id) {
    if (!window.confirm(`确认删除分类 ID=${id} 吗？分类下有文章时不能删除。`)) return

    try {
      const data = await requestJson(`/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      setMessage(data.message || '分类删除成功。')
      if (categoryForm.id === id) setCategoryForm(emptyCategoryForm)
      await loadAdminCategories()
    } catch (error) {
      setMessage(error.message)
    }
  }

  useEffect(() => {
    loadPublicCategories().catch(() => setMessage('分类加载失败。'))
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
            <button onClick={loadAdminArticles}>验证/刷新</button>
          </div>

          {message && <p className="admin-message">{message}</p>}
        </section>

        {isAdminVerified && (
          <section className="admin-card ops-card">
            <h2>运维入口</h2>
            <p>以下入口仅在管理员 Token 验证后显示。</p>
            <div className="ops-link-row">
              <a href={opsUrls.grafana} target="_blank" rel="noreferrer">打开 Grafana</a>
              <a href={opsUrls.prometheus} target="_blank" rel="noreferrer">打开 Prometheus</a>
            </div>
          </section>
        )}

        <section className="admin-card category-admin-card">
          <h2>分类管理</h2>

          <form className="category-form" onSubmit={submitCategory}>
            <input
              value={categoryForm.name}
              onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
              placeholder="分类名称，例如：生活随笔、学习记录、读书笔记"
            />
            <input
              value={categoryForm.slug}
              onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })}
              placeholder="分类 Slug，例如：life、study、reading"
            />
            <button type="submit">{categoryForm.id ? '保存分类' : '新增分类'}</button>
            <button type="button" onClick={() => setCategoryForm(emptyCategoryForm)}>清空</button>
          </form>

          <div className="category-admin-list">
            {categories.map((item) => (
              <article key={item.id} className="category-admin-item">
                <div>
                  <strong>{item.name}</strong>
                  <span>slug：{item.slug}</span>
                  {'article_count' in item && <span>文章数：{item.article_count}</span>}
                </div>
                <div>
                  <button type="button" onClick={() => editCategory(item)}>编辑</button>
                  <button type="button" onClick={() => deleteCategory(item.id)}>删除</button>
                </div>
              </article>
            ))}

            {categories.length === 0 && (
              <p className="no-comments">暂无分类，请在上方输入分类名称后新增。</p>
            )}
          </div>
        </section>

        <section className="admin-layout">
          <form className="admin-card admin-form" onSubmit={submitArticle}>
            <h2>{articleForm.id ? `编辑文章 #${articleForm.id}` : '新增文章'}</h2>

            <input
              value={articleForm.title}
              onChange={(event) => setArticleForm({ ...articleForm, title: event.target.value })}
              placeholder="标题"
            />

            <input
              value={articleForm.slug}
              onChange={(event) => setArticleForm({ ...articleForm, slug: event.target.value })}
              placeholder="Slug，例如 my-first-post"
            />

            <select
              value={articleForm.category_id || ''}
              onChange={(event) => setArticleForm({ ...articleForm, category_id: event.target.value })}
            >
              <option value="">未分类</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <select
              value={articleForm.status}
              onChange={(event) => setArticleForm({ ...articleForm, status: event.target.value })}
            >
              <option value="published">published</option>
              <option value="draft">draft</option>
            </select>

            <textarea
              rows="3"
              value={articleForm.summary}
              onChange={(event) => setArticleForm({ ...articleForm, summary: event.target.value })}
              placeholder="摘要"
            />

            <textarea
              rows="14"
              value={articleForm.content}
              onChange={(event) => setArticleForm({ ...articleForm, content: event.target.value })}
              placeholder="正文"
            />

            <div className="admin-actions">
              <button type="submit">保存文章</button>
              <button type="button" onClick={() => setArticleForm(emptyArticleForm)}>清空</button>
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

            {articles.length === 0 && <p className="no-comments">暂无文章，或 Token 未认证。</p>}
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
