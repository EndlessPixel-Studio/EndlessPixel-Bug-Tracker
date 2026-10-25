// ====================== 配置 ======================
const REPO = 'EndlessPixel-Studio/EndlessPixel-Bug-Tracker';
const API = `https://api.github.com/repos/${REPO}/issues`;
const PAGE_SIZE = 20;
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

const STATUS_MAP = {
    'status:已修复': '已修复',
    'status:未修复': '未修复',
    'status:不予修复': '不予修复',
    'status:无法修复': '无法修复',
    'status:待确认': '待确认',
    'status:重复': '重复',
    'status:特意设计为之': '特意设计为之',
};

// ====================== 状态 ======================
let BUGS = [];
let currentPage = 1;
let currentSelectedIndex = null;
let hasNextPage = false;

// ====================== URL 工具 ======================
function getQuery(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
}

function setQuery(key, value) {
    const params = new URLSearchParams(window.location.search);
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
    history.replaceState({}, '', '?' + params.toString());
}

// ====================== 缓存 ======================
function cacheGet(key) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const { t, v } = JSON.parse(raw);
        if (Date.now() - t > CACHE_TTL) {
            sessionStorage.removeItem(key);
            return null;
        }
        return v;
    } catch {
        return null;
    }
}

function cacheSet(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
    } catch { /* 忽略配额错误 */ }
}

// ====================== GitHub API ======================
function getStatus(labels) {
    const hit = labels.find(l => STATUS_MAP[l.name]);
    return hit ? STATUS_MAP[hit.name] : '待确认';
}

function getType(labels) {
    const hit = labels.find(l => l.name.startsWith('type:'));
    return hit ? hit.name.slice(5).trim() : '未分类';
}

async function fetchBugs(page = 1) {
    const cacheKey = `bugs_page_${page}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
        hasNextPage = cached.hasNextPage;
        return cached.bugs;
    }

    const url = `${API}?state=all&per_page=${PAGE_SIZE}&page=${page}&sort=created&direction=desc`;
    const res = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github+json' },
    });
    if (!res.ok) {
        const err = new Error(`GitHub API ${res.status}`);
        err.status = res.status;
        throw err;
    }

    const linkHeader = res.headers.get('link') || '';
    hasNextPage = linkHeader.includes('rel="next"');

    const issues = await res.json();
    const bugs = issues
        .filter(i => !i.pull_request)
        .map(i => ({
            number: i.number,
            no: `#${i.number}`,
            title: i.title,
            desc: i.body || '',
            report_player: i.user.login,
            date: i.created_at.slice(0, 10),
            fixed_date: i.closed_at ? i.closed_at.slice(0, 10) : null,
            status: getStatus(i.labels),
            type: getType(i.labels),
        }));

    cacheSet(cacheKey, { bugs, hasNextPage });
    return bugs;
}

async function fetchComments(issueNumber) {
    const cacheKey = `comments_${issueNumber}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const res = await fetch(`${API}/${issueNumber}/comments?per_page=100`, {
        headers: { 'Accept': 'application/vnd.github+json' },
    });
    if (!res.ok) return [];
    const comments = await res.json();
    cacheSet(cacheKey, comments);
    return comments;
}

// ====================== Markdown ======================
function renderMarkdown(md) {
    if (!md) return '';
    const raw = marked.parse(md);
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
}

// ====================== 骨架屏 ======================
function renderSidebarSkeleton() {
    const listEl = document.getElementById('bugSidebarList');
    listEl.innerHTML = Array.from({ length: PAGE_SIZE }).map(() => `
        <div class="skeleton-item">
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line medium"></div>
        </div>
    `).join('');
    document.getElementById('paginator').innerHTML = '';
}

function renderDetailSkeleton() {
    document.getElementById('bugDetailView').innerHTML = `
        <div class="skeleton-detail">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton-grid">
                ${Array.from({ length: 4 }).map(() => `<div class="skeleton skeleton-block"></div>`).join('')}
            </div>
            <div class="skeleton skeleton-desc"></div>
            <div class="skeleton skeleton-desc"></div>
            <div class="skeleton skeleton-desc"></div>
        </div>
    `;
}

// ====================== 渲染列表 ======================
function renderSidebar() {
    const listEl = document.getElementById('bugSidebarList');
    const paginatorEl = document.getElementById('paginator');
    listEl.innerHTML = '';

    if (!BUGS.length) {
        listEl.innerHTML = `<div class="placeholder">暂无Bug</div>`;
        paginatorEl.innerHTML = '';
        return;
    }

    BUGS.forEach((bug, offset) => {
        const realIndex = (currentPage - 1) * PAGE_SIZE + offset;
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        if (realIndex === currentSelectedIndex) item.classList.add('active');

        item.innerHTML = `
            <div class="item-id">${bug.no} · <span style="color: #535353;">${bug.report_player}</span></div>
            <div class="item-title">${bug.title} · <span class="status-tag status-${bug.status}">${bug.status}</span></div>
        `;

        item.addEventListener('click', () => selectBug(realIndex));
        listEl.appendChild(item);
    });

    paginatorEl.innerHTML = `
        <button ${currentPage <= 1 ? 'disabled' : ''} onclick="goPage(${currentPage - 1})">上一页</button>
        <span>第 ${currentPage} 页</span>
        <button ${hasNextPage ? '' : 'disabled'} onclick="goPage(${currentPage + 1})">下一页</button>
    `;
}

// ====================== 渲染详情 ======================
function renderDetail(index) {
    const detailEl = document.getElementById('bugDetailView');
    if (index === null || !BUGS[index]) {
        detailEl.innerHTML = `<div class="placeholder">请选择一个Bug查看详情</div>`;
        return;
    }

    const bug = BUGS[index];
    detailEl.innerHTML = `
        <div class="detail-header">
            <div class="detail-id">EndlessPixel / ${bug.no}</div>
            <h1 class="detail-title">${bug.title}</h1>
        </div>
        <div class="detail-section">
            <div class="info-grid">
                <div class="info-item"><span class="info-label">类型</span><span class="info-value">${bug.type}</span></div>
                <div class="info-item"><span class="info-label">状态</span><span class="info-value"><span class="status-tag status-${bug.status}">${bug.status}</span></span></div>
                <div class="info-item"><span class="info-label">报告玩家</span><span class="info-value">${bug.report_player}</span></div>
                <br>
                <div class="info-item"><span class="info-label">报告时间</span><span class="info-value">${bug.date}</span></div>
                ${bug.fixed_date ? `<div class="info-item"><span class="info-label">修复时间</span><span class="info-value">${bug.fixed_date}</span></div>` : ''}
            </div>
        </div>
        <div class="detail-section">
            <div class="section-title">问题描述</div>
            <div class="detail-desc markdown-body">${renderMarkdown(bug.desc)}</div>
        </div>
        <div class="detail-section">
            <div class="section-title">评论</div>
            <div id="commentSection"><div class="detail-desc">加载中…</div></div>
        </div>
    `;

    renderComments(bug.number);
}

async function renderComments(issueNumber) {
    const container = document.getElementById('commentSection');
    if (!container) return;

    try {
        const comments = await fetchComments(issueNumber);
        if (!comments.length) {
            container.innerHTML = `<div class="detail-desc">暂无评论</div>`;
            return;
        }
        container.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-author">${c.user.login}</span>
                    <span class="comment-time">${c.created_at.slice(0, 10)}</span>
                </div>
                <div class="comment-body markdown-body">${renderMarkdown(c.body)}</div>
            </div>
        `).join('');
    } catch {
        container.innerHTML = `<div class="detail-desc">评论加载失败</div>`;
    }
}

// ====================== 选择 Bug ======================
function selectBug(realIndex) {
    currentSelectedIndex = realIndex;
    const bug = BUGS[realIndex];
    if (bug) setQuery('bug', bug.number);
    renderSidebar();
    renderDetail(realIndex);
}

// ====================== 翻页 ======================
async function goPage(page) {
    if (page < 1) return;
    currentPage = page;
    setQuery('page', currentPage);
    currentSelectedIndex = null;
    setQuery('bug', null);
    await loadBugs();
}

// ====================== 加载 ======================
async function loadBugs() {
    renderSidebarSkeleton();
    if (currentSelectedIndex === null) renderDetailSkeleton();

    try {
        BUGS = await fetchBugs(currentPage);
        renderSidebar();
        renderDetail(currentSelectedIndex);
    } catch (e) {
        const msg = e.status === 403
            ? '请求过于频繁，请稍后再试'
            : `加载失败：${e.message}`;
        document.getElementById('bugSidebarList').innerHTML =
            `<div class="placeholder">${msg}</div>`;
        document.getElementById('paginator').innerHTML = '';
        document.getElementById('bugDetailView').innerHTML =
            `<div class="placeholder">${msg}</div>`;
    }
}

// ====================== 从 URL 加载 ======================
async function loadFromUrl() {
    const page = parseInt(getQuery('page'));
    if (page && page > 0) currentPage = page;

    await loadBugs();

    const bugNo = getQuery('bug');
    if (bugNo) {
        const idx = BUGS.findIndex(b => String(b.number) === bugNo);
        if (idx !== -1) {
            currentSelectedIndex = idx;
            renderSidebar();
            renderDetail(idx);
        }
    }
}

window.addEventListener('DOMContentLoaded', loadFromUrl);