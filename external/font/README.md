# font — 补充字体目录

OFD 文件中不在系统常规字体内的字体（如"方正小标宋简体"）会按**字体名**从本目录尝试加载，找不到则回退默认字体。

## 命名约定

字体文件名 = OFD 中的字体名 + 扩展名（无需处理空格/中文，库会自动 URL 编码）：

```
font/方正小标宋简体.ttf
font/方正小标宋简体.otf
font/方正小标宋简体.woff2
```

支持扩展名：`.ttf`、`.otf`、`.woff2`（按此顺序尝试，命中即用）。

## 目录位置

默认自动推导为 `ofd.js` 所在目录的上级 `/font/`（如 `build/ofd.js` → 项目根 `font/`）。
若字体目录在别处，可在加载前覆盖：

```html
<script src="build/ofd.js"></script>
<script>
  OFD.setFontBase('../assets/font/'); // 使用前调用一次即可
</script>
```

