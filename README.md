# 映标 · CINE MARKS 无框原色

## 远程订阅

[在线预览与主题切换](https://viceroy-dennis.github.io/cine-marks-noframe/)

| 入口 | 适用情况 | 固定订阅地址 |
| --- | --- | --- |
| **Rex 黑白自适应** | 单色图跟随主题，彩色图保持原样；需打开 Rex 对应开关 | [badges-rex-adaptive.json](https://viceroy-dennis.github.io/cine-marks-noframe/badges-rex-adaptive.json) |
| 固定浅色 PNG | 固定用于浅色背景 | [badges-light.json](https://viceroy-dennis.github.io/cine-marks-noframe/badges-light.json) |
| 固定深色 PNG | 固定用于深色背景 | [badges-dark.json](https://viceroy-dennis.github.io/cine-marks-noframe/badges-dark.json) |
| 网页自适应 SVG | 浏览器媒体查询；不用于 Rex 导入 | [badges-web-adaptive.json](https://viceroy-dennis.github.io/cine-marks-noframe/badges-web-adaptive.json) |

在 Rex 的 **「资源卡片 Badge」** 页面导入上述 Rex 地址，并开启 **「黑白图标自适应」**。31 枚单色图使用透明白色模板，Rex 检测后按当前系统文字颜色显示，浅色界面深色、深色界面浅色；其余 279 枚沿用原图字节，保留彩色、渐变及原生品牌底板。iTunes 保留用户指定的苹果 + iTunes 横向字标。

**旧地址已迁移：** `badges-adaptive.json` 和 `badges-rex.json` 与 `badges-rex-adaptive.json` 完全一致，均为原生 PNG 订阅。刷新原订阅即可取得新 PNG 地址；如果仍显示旧 SVG，请停用旧导入项，再导入新地址。`badges-rex-dark.json` 与 `badges-noframe.json` 保留固定深色兼容行为。历史 `themes/releases/` 图片继续保留。

**实现证据与验证范围：** 已静态核验 Rex 官网 macOS 1.1 build 24 安装包的设置文案、订阅模型、逐图检测及原生模板着色路径，见 [原生功能证据](docs/rex-native-adaptation.md) 和 [图像检测机制](docs/rex-image-detector.md)。PNG 自身不读取背景，是 Rex 的开关与渲染器负责切换。没有向 JSON 添加未经支持的主题字段。尚未在用户设备运行 Rex 验证此包，也不把网页模拟当成真机结果。

Rex 按整张图片检测，**彩色 Logo 中的白字不会局部变黑**。31 个单色模板包含 25 个已有黑白标识，以及 Blu-ray、NHK、Dolby Vision P5/P7/P8、SDR 六个中性灰标识；源文件和原色版本仍保留。需要彩色图白字局部适配时，固定浅色 PNG 与网页 SVG 仍提供此前逐项审核的变体。

网页预览使用 PNG，并仅对这 31 枚模板模拟主题文字颜色。独立的网页 SVG 使用 `prefers-color-scheme`，需要宿主正确设置 `color-scheme`。所有订阅继续保留原配置的 ID、规则和其余字段，仅修改 `imageURL`。

GitHub Pages 返回 JSON / SVG 对应的内容类型。PNG 地址锁定完整 Git 提交；SVG 放入 `themes/releases/<素材提交>/`，历史发布目录保留，避免更新覆盖已发布图片。GitHub 的 CDN 缓存及客户端刷新频率可能延迟更新。

![品牌与技术标识原色复审展示](color-review.png)

310 项资源标签，15 个分类。原配置的 ID、名称、正则、分组、排序和启停状态均保持一致，仅修改 imageURL：293 条启用、17 条停用。

这套素材取消了统一灰色及香槟色遮罩。平台标识保留来源中的品牌色、多色组合与渐变；单色字标提供深色背景的白色版本与浅色背景的深色版本，逐项记录变换。没有给所有图标套用同一种颜色。

## 发布验证

原生 PNG 资产已完成全量检查：31 个模板的可见像素全部为纯白，279 个原色文件与源文件逐字节一致，全部 310 个尺寸和透明度通道不变。根据已核验检测阈值，在全分辨率及三种近似缩放采样下均为 31 个单色、279 个彩色，无误分类。CoreGraphics 的精确缩放与用户设备实际显示仍需原生复验。资产记录见 `themes/rex-build-manifest.json`；发布网络验证见 `themes/rex-verification.json`。

构建器测试涵盖规则保留、原生 PNG、浏览器 SVG、别名一致、素材提交校验和历史发布目录保护。旧 SVG 导入 Rex 后全部变白的用户反馈保留在 `consumer-compatibility.json`；新入口避开该 SVG 解码路径。旧浏览器主题验证记录见 `themes/verification.json`。

## 本次复审

- 全部 310 项均已逐张视觉审查，使用深浅背景对照图检查。
- 原包 52 个平台文字占位已替换。
- “来源 / 平台”分组包含 88 个平台品牌和 4 个物理片源标签。87 个平台品牌有外部素材来源，iTunes 使用用户指定参考图；不把参考图颜色等同于官方颜色。
- 104 项采用替换素材，其中 103 项来自外部来源，1 项 iTunes 来自用户指定参考图，包括平台与技术商标。其余 206 项保留参考配色，主要是规格、语言、质量评级和制作组文字，不宣称其为官方品牌标志。
- 恢复彩色细节，例如咪咕红蓝、西瓜粉红、抖音青红、Peacock 六色圆点、STARZ 渐变、HDR10+ 彩虹、HDR Vivid 红蓝、DTS 系列橙黄、FLAC 彩色电平条。
- NHK 官网本身采用灰色，保留其真实灰色；Sony Pictures Core、LINE TV、Viu 等按实际来源分别换成白色、绿白、亮黄色。

## 文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | 可离线搜索、筛选、切换尺寸和下载图标的预览 |
| `preview.png` | 浏览器预览截图 |
| `color-review.png` | 重点平台和技术标识复审展示 |
| `badges/png/` | 310 个 PNG，统一高 96px，建议显示高 24–32px |
| `badges/svg/` | 310 个自包含 SVG；有纯矢量来源，也有内嵌位图 |
| `badges.relative.json` | 相对图片地址配置 |
| `badges-noframe.json` | 旧版深色 PNG 兼容订阅 |
| `badges-rex-adaptive.json`、`badges-rex.json`、`badges-adaptive.json` | 相同的 Rex 原生黑白自适应 PNG 订阅 |
| `badges-web-adaptive.json`、`badges-light.json`、`badges-dark.json` | 网页 SVG、固定浅色 PNG、固定深色 PNG 订阅 |
| `badges-rex-dark.json` | 固定深色 PNG 的旧别名 |
| `themes/rex/`、`themes/rex-map.json` | Rex PNG 与逐项模板/保留原图决策 |
| `themes/light/`、`themes/adaptive/` | 310 个浅色 PNG 与 310 个自包含自适应 SVG |
| `themes/theme-map.json` | 每项主题处理区域、规则、原因与原图校验哈希 |
| `audit-report.md`、`audit.json` | 逐项来源状态、检查结果与限制 |
| `sources.json` | 原始URL、外部素材URL、来源证据与每项变换 |
| `design-prompt.md` | 设计说明与完整可复制提示词 |

## 使用与限制

已为 59 项白色或浅灰前景提供浅色变体：25 个单色标识、33 个彩色与白字组合、1 个金灰渐变符号。彩色组合仅改变经逐项审核的中性前景，保留图标内的白色符号和彩色细节。金灰星芒使用单独的亮度处理，保留其渐变；这是可读性适配，不宣称为官方新配色。13 个原生容器和其他无需适配的图标保持原样。

“无框”指不新增装饰性边框、底座、阴影。少数平台使用官方应用图标，其图标自身的圆角底板、品牌容器或内部渐变保留，例：Bstation、华数TV、Sky Go、KKTV、1905。没有为了透明强行重绘它们。

PPTV 使用可追溯的中国 PPTV 历史“聚力(PP)”标志，源图只有 120×30，仍有清晰度限制。Funimation、Google Play Movies、乐视等使用历史素材，便于识别旧片源，不代表现在仍以同一品牌运营。

SVG 是否为矢量见 `catalog.json` 的 `assetType`。含位图的容器不能保证无限放大无损。部分 SVG 的嵌套位图或颜色适配已通过渲染固定为 PNG，避免终端渲染差异。

Rex 的 SVG 导入失败已记录；Rex 原生入口沿用原配置的 groups / filters 结构和 HTTPS PNG。相对地址配置只用于本地或自行托管，不能直接作为远程订阅。

GitHub 版本包含最终 PNG/SVG 和独立构建工具。体积较大的 PNG data URI 内嵌 JSON 不重复提交；需要离线素材时可下载仓库 ZIP。

素材出处逐项记录。乐视 SVG 的 Commons 条目注明 CC-BY-SA 4.0；相关修改及缩放均记录于来源清单，使用该素材时保留来源与同许可要求。其余商标和图标的权利归相应权利人，不宣称本资源包获得官方授权。

## 维护与重新发布

订阅构建需要 Git 和 Node.js 20 或更新版本，无运行时 npm 依赖。重新生成主题图片需先 `npm install`，渲染依赖固定为 `@resvg/resvg-js@2.6.2`。先修改并审核 `badges/png/`、对应 SVG、来源表和相对配置，再提交素材；构建器会检查素材是否与选定提交逐字一致。

```sh
git add badges badges.relative.json catalog.json sources.json audit.json audit-report.md
git commit -m "Update reviewed badge assets"
npm run build:github
git add badges-noframe.json
git commit -m "Publish badge subscription"
git push origin main
```

构建器从 `origin` 读取 GitHub 仓库、从 `HEAD` 读取素材提交，也支持显式参数：

```sh
node scripts/build-github.mjs --repository OWNER/REPO --asset-ref FULL_40_CHARACTER_COMMIT_SHA
npm test
```

只重写 `imageURL`；识别正则、不可见字符、ID、分组、顺序、启用状态和其他字段原样保留。未提交的素材、缺失文件或无效 PNG 会中止构建。发布工具仅生成本地 JSON，`git push` 才会上传到 GitHub。

预览可在解压后直接打开 `index.html`；也可在仓库目录运行 `python -m http.server 8766`，访问 `http://localhost:8766/`。

## 主题素材维护

原始深色素材在 `badges/png/`；经逐项审核的变换在 `themes/theme-map.json`。修改原图后必须重新审核区域与原图哈希，再运行 `npm run build:themes`。渲染不增加边框、底板、阴影或光晕。所有主题版本保留原图尺寸与 alpha 通道。

Rex 原生素材使用 `themes/rex-map.json` 记录模板选择，运行 `npm run build:rex`。生成器校验源哈希、图标范围和保护列表；只把确认的单色标识输出为白色 alpha 模板，彩色图复制原始字节。同步提交 `themes/rex/` 后再生成订阅。

提交审核后的原始图、浅色 PNG、自适应 SVG，然后生成订阅和不可变发布目录：

```sh
node scripts/build-theme-subscriptions.mjs --repository Viceroy-Dennis/cine-marks-noframe --asset-ref FULL_40_CHARACTER_COMMIT_SHA --site-base https://viceroy-dennis.github.io/cine-marks-noframe
git add badges-light.json badges-dark.json badges-adaptive.json badges-web-adaptive.json badges-rex.json badges-rex-adaptive.json badges-rex-dark.json themes/releases
git commit -m "Publish theme subscriptions"
git push origin main
```

GitHub Pages 从 `main` 根目录发布。保留已发布的 `themes/releases/`；同一目录中的文件不得替换为不同字节。预览 SVG 使用内嵌 PNG，不能当作无限缩放的纯矢量原稿。

浏览器主题行为依据：[MDN prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) 与 [W3C Media Queries 5](https://www.w3.org/TR/mediaqueries-5/#prefers-color-scheme)。

## iTunes 字标

`stream-019` 已按用户提供的苹果 + iTunes 参考图替换为横向透明字标，取消旧应用图标底板。深底用白色，浅底用深色。素材经内置图像编辑工具提取和整理，不是从 Apple 官网取得的矢量母版；来源及处理见 `sources.json`，可复用的提取提示词见 `sources/user/itunes-edit-prompt.txt`。
