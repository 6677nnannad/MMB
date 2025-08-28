
export default async function handler(req, res) {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允许POST请求', success: false });
  }

  try {
    const { text, image, filename = 'content' } = req.body;

    if (!text && !image) {
      return res.status(400).json({ 
        error: '请提供文本或图片数据', 
        success: false 
      });
    }

    const results = {};

    // 上传文本到 txa 文件夹
    if (text) {
      const textResult = await uploadToGitHub(text, 'txa', 'txt', `文本_${filename}`);
      results.text = textResult;
      if (!textResult.success) {
        return res.status(500).json({
          success: false,
          error: '文本上传失败: ' + textResult.error
        });
      }
    }

    // 上传图片到 img 文件夹
    if (image) {
      const imageResult = await uploadToGitHub(image, 'img', 'image', `图片_${filename}`);
      results.image = imageResult;
      if (!imageResult.success) {
        return res.status(500).json({
          success: false,
          error: '图片上传失败: ' + imageResult.error
        });
      }
    }

    res.status(200).json({
      success: true,
      message: '内容上传成功',
      data: results
    });

  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误: ' + error.message
    });
  }
}

async function uploadToGitHub(content, folder, type, originalName) {
  try {
    const GITHUB_OWNER = '6677nnannad';
    const GITHUB_REPO = 'MMB';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    
    let fileName, fileContent;

    if (type === 'txt') {
      fileName = `${timestamp}_${randomStr}.txt`;
      fileContent = Buffer.from(content).toString('base64');
    } else {
      const matches = content.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        return { success: false, error: '无效的图片格式' };
      }
      const imageType = matches[1];
      fileName = `${timestamp}_${randomStr}.${imageType}`;
      fileContent = matches[2];
    }

    const githubPath = `${folder}/${fileName}`;
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${githubPath}`;

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MMB-Content-Server'
      },
      body: JSON.stringify({
        message: `添加${type === 'txt' ? '文本' : '图片'}: ${originalName}`,
        content: fileContent,
        branch: 'main'
      })
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        url: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${githubPath}`,
        filename: fileName,
        githubUrl: result.content.html_url
      };
    } else {
      return { 
        success: false, 
        error: result.message || 'GitHub API错误' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}
