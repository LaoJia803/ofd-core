外部字体目录 / External fonts

引擎在 OFD 未内嵌某字体、且内置系统映射与本机同名字体都取不到时，
会按「字体原始名.ttf|.otf|.woff2」从这个目录加载。
默认目录由 ofd.min.js 的位置推断为 <根>/font/，把字体文件放进本目录即可，
无需再调用 OFD.setFontBase()。若引擎被放在别处，可显式指定：
  OFD.setFontBase('path/to/font/');

When an OFD references a font that is not embedded and cannot be resolved via
the built-in/system mapping, the engine fetches it as <originalName>.ttf|.otf|.woff2
from this directory. It is auto-detected from the ofd.min.js location as <root>/font/,
so no OFD.setFontBase() call is required.