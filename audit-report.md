# 无框原色审核记录

已审查全部310个输出。88个平台品牌全部替换为外部可追溯素材，原52个圆点/文字占位全部移除。104项采用新来源；206项保留参考图配色。这里的“已审查”表示查看了输出，不意味着把206项都认证为官方商标颜色。

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

当前是适合深色资源列表的颜色版本。白字在浅底不保证可读；浅底展示用于检查透明边缘。部分官方应用图标保留自身底板/内部阴影，没有额外加框；不能称其内部每一像素均透明。

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
