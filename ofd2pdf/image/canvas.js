// 浏览器路径：交给 canvas 解 PNG/BMP/GIF，取首帧 RGBA。
// 浏览器：GIF/BMP/PNG → canvas 提取 RGBA（透明通道保留；GIF 取首帧）
export function canvasImageToRgba(bytes, mime) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      const blob = new Blob([bytes], { type: mime });
      url = URL.createObjectURL(blob);
    } catch (e) { reject(e); return; }
    const img = new Image();
    img.onload = () => {
      try {
        if (!img.width || !img.height) throw new Error('图像尺寸为 0');
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const g = canvas.getContext('2d', { willReadFrequently: true });
        if (!g) throw new Error('无法获取 canvas 2d 上下文');
        g.drawImage(img, 0, 0);
        const data = g.getImageData(0, 0, img.width, img.height).data;
        resolve({ w: img.width, h: img.height, rgba: data });
      } catch (e) { reject(e); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(mime + ' 图像加载失败')); };
    img.src = url;
  });
}
