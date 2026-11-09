# 无框原色审核记录

已审查全部310个输出。88个平台品牌均有来源记录（87项外部素材、1项用户指定iTunes），原52个圆点/文字占位全部移除。104项采用替换素材（103项外部来源、1项用户参考）；206项保留参考图配色。这里的“已审查”表示查看了输出，不意味着把206项都认证为官方商标颜色。

## 修正结果

取消统一灰色和香槟色处理。恢复/重取多色品牌图形，分别保留每个品牌的渐变与色彩。单色字标的深色界面反白适配单独记录；没有为彩色品牌套用全图灰色遮罩。

重点修复：咪咕、搜狐、西瓜、抖音、乐视、PPTV；Peacock彩色圆点；STARZ、Discovery+、Viu、LINE TV、Sony Pictures Core；HDR10+彩虹及“10+”完整内容；HDR Vivid；DTS:X、DTS-HD、DTS-HD MA；FLAC。

二次审查发现并修复了Disney+和YouTube Premium暗底低对比、Google Movies白底、HDR10+阴影与嵌套位图丢失、FLAC黑底、Dolby和DTS暗底低对比问题。

## 检查

| 检查 | 结果 |
|---|---|
| PNG/SVG对应310个ID | 通过 |
| groups/filters顺序及非imageURL字段 | 与参考逐字一致 |
| 293启用 / 17停用 | 保留 |
| 96px输出高度及透明外部留白 | 通过 |
| 浏览器全部图像加载 | 310项，0破图 |
| 控制台 | 0相关错误 |
| 搜索、详情、24px尺寸切换 | 通过 |
| PNG实际下载 | 哈希与交付图一致 |
| 390×844手机横向溢出 | 无 |

## 实际限制

原始素材保留深色版本，另补 59 项浅色前景变体。预览会实际切换图像中的主题层，独立浅色 PNG 和自适应 SVG 已纳入发布。部分官方应用图标保留自身底板/内部阴影，没有额外加框；不能称其内部每一像素均透明。

PPTV的历史聚力(PP)源图120×30，放大仍略模糊。历史Logo的来源已记录，未声称每个都是最新品牌规范。

制作组名和普通规格/等级/语言文字保留参考方案，不虚构官方Logo。下列技术/片源项目仍使用参考图，颜色已恢复但未取得独立品牌原稿：

- `s-hdtv` — HDTV
- `s-dvd` — DVD RIP
- `custom_dolby-vision-p5` — Dolby Vision P5
- `custom_dolby-vision-p7` — Dolby Vision P7
- `custom_dolby-vision-p8` — Dolby Vision P8
- `custom_hdr10_10` — HDR10
- `custom_hdr_11` — HDR
- `custom_sdr_12` — SDR
- `v-3d` — 3D
- `video-hlg` — HLG
- `a-aac` — AAC
- `a-opus` — OPUS
- `a-mp3` — MP3
- `a-pcm` — PCM

远程订阅配置位于仓库根目录 `badges-noframe.json`。固定订阅地址为 [https://raw.githubusercontent.com/Viceroy-Dennis/cine-marks-noframe/main/badges-noframe.json](https://raw.githubusercontent.com/Viceroy-Dennis/cine-marks-noframe/main/badges-noframe.json)；图片 URL 锁定至完整素材提交 SHA。浏览器和配置检查不替代实际消费应用的订阅导入测试。

线上发布验证：固定 JSON 返回 HTTP 200，310/310 张远程 PNG 与本地逐字节一致，0 缺失。GitHub Raw 的 JSON 响应类型为 text/plain; charset=utf-8，缓存 max-age=300，CORS 为 *；详细记录见 publication.json。尚未在实际消费应用执行导入与刷新测试。

## 深浅主题复审

主题适配阶段保留原图；此次 iTunes 按用户参考单独替换，其余 309 个 PNG 与 SVG 保持前次提交内容。59 个浅色变体尺寸与 alpha 通道逐像素一致；58 个非金灰处理变体的所有可见彩色像素 RGB 保持一致。金灰星芒只做明确记录的亮度适配并保留渐变。13 个原生容器内部白色保持，251 项无需改色的 PNG 逐字节复用原稿。

修复前，杜比视界、杜比全景声、TrueHD、Sony Pictures Core、DAZN 的白字在白底上没有达到 3:1 对比度的核心像素。浅色变体的这些单色核心像素全部通过同一检查。彩色品牌不是通用文字，不以此声明每个品牌色都达到 WCAG 文本阈值。

腾讯、WeTV、YouTube 等内部白色播放符号保留；外部白字才变深。Pluto TV 的末端 tv 是透明字孔，因此尾圈也随主题变深，字孔保持透明。自适应是否跟随实际应用，取决于使用端 SVG 解码与主题传递；不支持时使用固定浅色/深色 PNG 入口。

## Rex 导入与 iTunes 更换

用户报告：自适应 SVG 导入 Rex 后所有图标变白、浅底不可见。静态检查确认 SVG 内嵌的 PNG 本身仍有颜色；忽略 SVG 样式只能解释部分白字覆盖，不能证明整体白化的根因。宿主染色、SVG/data URI 解码均未取得实现证据。

此前的临时方案提供固定浅色/深色 PNG。现已由 Rex 原生黑白自适应方案取代：badges-rex-adaptive.json、badges-rex.json、badges-adaptive.json 均指向同一套 PNG；固定浅色/深色入口另行保留。

iTunes 从方形应用图标替换为用户指定的苹果 + iTunes 横向透明字标，输出 357×96，深浅稿分别为白色/深色。来源为用户参考经内置图像工具编辑的衍生素材，不宣称是官方矢量原稿。旧截图/联系表保留为历史检查证据。

## Rex 原生黑白适配

已核验官方 macOS 1.1 build24 的设置「黑白图标自适应」以及逐图检测、模板着色调用。31个单色标识输出为纯白alpha模板，279个彩色/原生容器素材保留原图字节。全310个尺寸与透明度不变；31个模板均满足检测阈值，三种近似采样未误判其余279个。

此方案依赖Rex内的开关，不依赖SVG媒体查询，不添加虚构JSON字段。彩色图内白字不会局部变色。静态程序证据、素材审核、浏览器模拟和用户设备实际导入分开记录，未声称执行Rex真机测试。详见docs/rex-native-adaptation.md、themes/rex-verification.json。
