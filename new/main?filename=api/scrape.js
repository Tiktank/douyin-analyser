// api/scrape.js
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// 强制指定Chromium路径（解决Vercel环境问题）
chromium.setGraphicsMode = false; // 禁用GPU加速
process.env.CHROMIUM_PATH = chromium.path;

module.exports = async (req, res) => {
  const { uid } = req.query;
  
  // 基础参数验证
  if (!uid || uid.length > 30) {
    return res.status(400).json({ error: '无效的抖音ID格式' });
  }

  // 浏览器启动配置（内存优化）
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--single-process'],
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport,
    timeout: 15000 // 增加超时时间
  });

  try {
    const page = await browser.newPage();
    
    // 设置请求拦截（提升性能）
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (!['document', 'script'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // 访问目标页面
    await page.goto(`https://www.douyin.com/user/${uid}`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });

    // 数据抓取逻辑（已适配最新抖音页面结构）
    const data = await page.evaluate(() => {
      const extractNumber = (selector) => {
        const elem = document.querySelector(selector);
        return elem ? elem.innerText.replace(/\D/g, '') || '0' : 'N/A';
      };

      return {
        followers: extractNumber('[data-e2e="followers-count"]'),
        following: extractNumber('[data-e2e="following-count"]'),
        likes: extractNumber('[data-e2e="likes-count"]'),
        videos: extractNumber('[data-e2e="video-count"]')
      };
    });

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ 
      error: '数据抓取失败',
      detail: e.message
    });
  } finally {
    await browser.close();
  }
};
