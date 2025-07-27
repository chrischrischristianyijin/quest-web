import express from 'express';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const router = express.Router();

router.get('/api/v1/metadata', async (req, res) => {
  try {
    const { url } = req.query;
    console.log('收到请求，url:', url);
    
    if (!url) {
      console.log('缺少 url 参数');
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Special handling for YouTube URLs
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu.be\/)([^&]+)/);
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      console.log('检测到 YouTube 链接，videoId:', videoId);
      const response = await fetch(`https://www.youtube.com/oembed?url=${url}&format=json`);
      if (!response.ok) {
        console.log('YouTube oEmbed 请求失败，状态码:', response.status);
        return res.status(500).json({ error: 'YouTube oEmbed fetch failed' });
      }
      const data = await response.json();
      console.log('YouTube oEmbed 返回数据:', data);
      
      return res.json({
        title: data.title,
        description: data.author_name,
        image_url: thumbnailUrl
      });
    }

    // For other URLs
    console.log('开始 fetch 外部网页:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MyBot/1.0; +https://yourdomain.com/bot)'
      }
    });
    if (!response.ok) {
      console.log('fetch 失败，状态码:', response.status);
      return res.status(500).json({ error: `Fetch failed with status ${response.status}` });
    }
    const html = await response.text();
    console.log('网页内容长度:', html.length);

    const dom = new JSDOM(html);
    const document = dom.window.document;

    const title = document.querySelector('meta[property="og:title"]')?.content ||
                  document.querySelector('title')?.textContent || '';
    const description = document.querySelector('meta[property="og:description"]')?.content ||
                        document.querySelector('meta[name="description"]')?.content || '';
    const image_url = document.querySelector('meta[property="og:image"]')?.content ||
                      document.querySelector('meta[property="twitter:image"]')?.content || '';

    console.log('抓取到的元数据:', { title, description, image_url });

    const metadata = { title, description, image_url };

    res.json(metadata);
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

export default router; 