# Rex 原生黑白图标自适应：静态核验

2026-11-09 核验了 Rex 官网公开分发的 **macOS 1.1（build 24，arm64）** 安装包。只解包并读取资源和 Swift 反射元数据，未安装、启动或运行 Rex。以下结论针对该构建，不等于用户设备上的运行时测试。

## 官方功能说明

安装包内简体中文设置文案明确包含：

> **黑白图标自适应**  
> 逐张检测，纯黑或纯白图标会自动适配深浅模式；彩色图标保持原样。

对应键为 `settings.resourceBadge.page.adaptive` 和 `settings.resourceBadge.page.adaptive.detail`；页面标题是 **资源卡片 Badge**。

因此，Rex 确有应用自身的单色图标适配功能，静态 PNG 可以参与该功能。推荐使用普通透明 PNG 订阅，并在 Rex 的“资源卡片 Badge”设置页启用“黑白图标自适应”。无需为此向规则 JSON 添加推测的主题字段。

在此构建的本地化资源中，还确认了“设置”“外观与交互”“图标”“资源卡片 Badge”这些标签。其中 `settings.interface.page.icons.badge` 指向“资源卡片 Badge”。这些是可靠的界面标签；实际菜单层级、开关位置及用户设备上的默认值未通过运行界面验证。

## 配置与模型证据

Swift 名义类型与字段描述符显示，`RexBadgeCore.ResourceBadgeFilter` 和它所属的 `CodingKeys` 均包含且仅包含以下十项：

```text
id, name, pattern, tagColor, borderColor,
textColor, tagStyle, imageURL, isEnabled, groupId
```

未在该订阅模型及其 CodingKeys 中发现 `theme`、`renderMode`、`isTemplate` 或 `adaptsMonochromeImage`。这比全局字符串搜索更能确定真实模型边界，但未声称已反汇编每条解码分支。

另有以下相互吻合的内部结构：

- `RexBadgeCore.ResourceBadgeImageTone` 类型。
- `RexBadgeCore.ResourceBadgePackCenter` 的 `persistAdaptiveIconColors` 和 `lastAdaptiveIconColorsEnabled` 状态。
- 内部偏好名 `adaptiveResourceBadgeIconColors`。
- `RexMacUI.MacResourceBadge`、`RexMacUI.MacBadgeRecord` 与 `RexPlayerCore.PlaybackResource.Presentation.Badge` 的布尔显示字段 `adaptsMonochromeImage`。

这些证据支持“应用内开关与图片检测控制显示”的实现，而不是通过订阅新增 JSON 参数控制。`adaptsMonochromeImage` 是显示模型中的内部属性，不能据此作为可导入规则键发布。

## 使用范围

- 官方文案描述的是逐张检测纯黑或纯白图标；它未承诺对同一彩色 Logo 中的白色文字单独变色。
- 彩色图标保持原样。对带白字的彩色 Logo，仍应检查浅色背景可读性，不能将此功能等同于任意图片的局部主题转换。
- 本次确认原生功能存在，但未在运行中的 Rex 验证本资源包，也未通过此核验确认 SVG、媒体查询或嵌入 PNG 的兼容性。

## 来源与校验值

- 官网：<https://rexnow.tv/>
- 官网公开下载：<https://updates.rexnow.app/macos/stable/releases/24/Rex-1.1-24-arm64-5505197161da.dmg?release=24>
- Bundle ID：`tv.rexnow.app`
- 版本：`1.1`；构建：`24`；最低 macOS：`14.0`
- DMG 大小：`116307892` 字节
- DMG SHA-256：`5505197161daf01c18ee022c2b379ffbe719cd588523a0c2036f3eb72861368b`
- 主 Mach-O SHA-256：`94f6e651ed800d5ccc3a292e5b670fef55594d7222bccf8e1a374a8af55a5789`
- 文案来源：`Rex.app/Contents/Resources/zh-Hans.lproj/Settings.strings`
- 类型来源：`Rex.app/Contents/MacOS/Rex` 的 `__swift5_types`、`__swift5_fieldmd` 和 `__swift5_reflstr`

此报告与配套 JSON 仅包含必要的事实、字段名、少量界面文案和校验值，不包含应用二进制、完整反射转储或应用代码。
