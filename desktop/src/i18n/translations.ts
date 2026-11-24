export type Locale = 'zh-CN' | 'en-US'

export interface Translations {
  // Common
  appName: string
  localeSwitchLabel: string
  localeSwitchAria: string
  cancel: string
  confirm: string
  save: string
  saving: string
  saved: string
  close: string
  retry: string
  copied: string
  copyFailed: string
  copyCommandAria: string

  // Command Popup Topbar & Input
  commandToolbarAria: string
  pickTargetPrompt: string
  addTarget: string
  targetCountSuffix: string
  permAuto: string
  permManual: string
  permGroupAria: string
  openStudio: string
  settingsAria: string
  collapseToPillAria: string
  hideWindowAria: string
  commandInputLabel: string
  commandPlaceholder: string
  sendActionAria: string
  stopExecution: string
  modeMinimal: string
  modeGuarded: string
  dragHandleAria: string

  // Slash commands
  slashMenuAria: string
  slashPickDesc: string
  slashModeDesc: string
  slashPermDesc: string
  slashStudioDesc: string
  slashSettingsDesc: string
  slashClearDesc: string

  // Onboarding & Daemon
  daemonConnecting: string
  daemonAttached: string
  daemonSpawned: string
  daemonDemoMode: string
  missingBackendTitle: string
  missingBackendDesc: string
  installViaUv: string
  installingViaUv: string
  installUvHint: string
  installFailed: string
  restartEngine: string

  // Inline Config Drawer
  configDrawerTitle: string
  configMissingKeyNotice: string
  providerPresetLabel: string
  providerCustom: string
  modelLabel: string
  baseUrlLabel: string
  apiKeyLabel: string
  apiKeyConfiguredPlaceholder: string
  apiKeyEmptyPlaceholder: string
  configSavedToast: string

  // Conversation / Execution stream
  thinkingLabel: string
  stepPrefix: string
  actionChipLabel: string
  approvalRequiredTitle: string
  approveAction: string
  rejectAction: string
  statusRunning: string
  statusWaitingApproval: string
  statusCompleted: string
  statusAborted: string
  statusError: string
  youLabel: string
  agentLabel: string
  clearConversation: string
  noOutputYet: string

  // Visual Picker
  pickerToolbarAria: string
  pickerModeHover: string
  pickerModeGrid: string
  pickerModeCdp: string
  pickerEscHint: string
  pickerHoverGuide: string
  pickerDragRegionLabel: string
  pickerRegionCustomTitle: string
  pickerDisplaysSection: string
  pickerWindowsSection: string
  pickerEmptyTargets: string
  pickerSelectedCount: string
  pickerBindSelected: string
  pickerCdpTitle: string
  pickerCdpRefresh: string
  pickerCdpEmptyTitle: string
  pickerCdpEmptyDesc: string
  pickerCdpLaunchHint: string
  pickerCdpBackgroundBadge: string
  pickerLoading: string
  pickerMinimizedBadge: string

  // Target Border
  borderControlling: string

  // Status Pill
  pillRunning: string
  pillStep: string
  pillApprovalNeeded: string
  pillApprove: string
  pillReject: string
  pillStop: string
  pillExpand: string
  pillIdle: string

  // Browser Preview Switcher (dev/non-Tauri only)
  previewBadge: string
  previewViewCommand: string
  previewViewPicker: string
  previewViewBorder: string
  previewViewPill: string
  previewSimApproval: string
  previewSimMissingBackend: string
}

export const translations: Record<Locale, Translations> = {
  'zh-CN': {
    appName: 'AEFlow',
    localeSwitchLabel: 'EN',
    localeSwitchAria: 'Switch interface language to English',
    cancel: '取消',
    confirm: '确认',
    save: '保存配置',
    saving: '保存中...',
    saved: '已保存',
    close: '关闭',
    retry: '重试',
    copied: '已复制',
    copyFailed: '复制失败',
    copyCommandAria: '复制安装命令',

    commandToolbarAria: 'AEFlow 快捷控制栏',
    pickTargetPrompt: '选择目标窗口',
    addTarget: '+ 目标',
    targetCountSuffix: '个目标',
    permAuto: '自主',
    permManual: '审批',
    permGroupAria: '执行权限模式',
    openStudio: '工作台',
    settingsAria: '模型与引擎设置',
    collapseToPillAria: '收起为状态胶囊',
    hideWindowAria: '隐藏命令浮窗',
    commandInputLabel: '输入要让 AEFlow 执行的任务指令',
    commandPlaceholder: '你想干什么？ // 输入以开始',
    sendActionAria: '发送指令',
    stopExecution: '停止',
    modeMinimal: '极简代码',
    modeGuarded: '受控安全',
    dragHandleAria: '拖动窗口',

    slashMenuAria: '快捷斜杠命令',
    slashPickDesc: '打开可视化窗口与区域选择器',
    slashModeDesc: '切换执行引擎（极简代码 / 受控安全）',
    slashPermDesc: '切换权限模式（自主执行 / 人工审批）',
    slashStudioDesc: '在浏览器中打开完整 Studio 工作台',
    slashSettingsDesc: '配置模型、服务地址与密钥',
    slashClearDesc: '清空当前对话流',

    daemonConnecting: '连接本地引擎中...',
    daemonAttached: '已附着本地引擎',
    daemonSpawned: '本地引擎已就绪',
    daemonDemoMode: '预览模式',
    missingBackendTitle: '尚未检测到本地 AEFlow 引擎',
    missingBackendDesc: '通过 uv 安装轻量级后端后即可接管桌面视口并执行操作。',
    installViaUv: '通过 uv 一键安装后端',
    installingViaUv: '正在通过 uv 安装...',
    installUvHint: '或在终端执行：',
    installFailed: '安装未能完成',
    restartEngine: '重启引擎',

    configDrawerTitle: '模型快速配置',
    configMissingKeyNotice: '尚未配置模型密钥，填写后即可开始执行桌面任务。',
    providerPresetLabel: '服务商预设',
    providerCustom: '自定义',
    modelLabel: '模型名称',
    baseUrlLabel: '接口地址',
    apiKeyLabel: 'API Key',
    apiKeyConfiguredPlaceholder: '已配置（留空保持不变）',
    apiKeyEmptyPlaceholder: '输入 sk-... 或兼容密钥',
    configSavedToast: '配置已生效',

    thinkingLabel: '思考中',
    stepPrefix: '步骤',
    actionChipLabel: '操作',
    approvalRequiredTitle: '等待人工审批',
    approveAction: '批准',
    rejectAction: '拒绝',
    statusRunning: '执行中',
    statusWaitingApproval: '待审批',
    statusCompleted: '已完成',
    statusAborted: '已中止',
    statusError: '执行出错',
    youLabel: '指令',
    agentLabel: 'AEFlow',
    clearConversation: '清空记录',
    noOutputYet: '正在感知目标视口...',

    pickerToolbarAria: '可视化目标选择模式切换',
    pickerModeHover: '拾取窗口 / 框选区域',
    pickerModeGrid: '缩略图网格 (Tab)',
    pickerModeCdp: '无头浏览器 CDP',
    pickerEscHint: 'Esc 退出',
    pickerHoverGuide: '移动光标悬停高亮窗口并单击绑定，或按住鼠标左键拖拽框选任意区域',
    pickerDragRegionLabel: '自定义区域',
    pickerRegionCustomTitle: '自定义区域',
    pickerDisplaysSection: '显示器',
    pickerWindowsSection: '应用窗口',
    pickerEmptyTargets: '未检测到可用窗口或显示器',
    pickerSelectedCount: '已选择',
    pickerBindSelected: '绑定目标',
    pickerCdpTitle: '后台无头浏览器标签页',
    pickerCdpRefresh: '刷新列表',
    pickerCdpEmptyTitle: '未发现开启远程调试的浏览器页面',
    pickerCdpEmptyDesc: '使用远程调试端口启动 Chrome、Edge 或 Electron，即可在不抢占焦点与光标的情况下后台操控页面。',
    pickerCdpLaunchHint: 'chrome --remote-debugging-port=9222',
    pickerCdpBackgroundBadge: '零干扰后台',
    pickerLoading: '正在扫描可用目标...',
    pickerMinimizedBadge: '已最小化',

    borderControlling: 'AEFlow 控制中',

    pillRunning: '执行中',
    pillStep: '步骤',
    pillApprovalNeeded: '需要审批',
    pillApprove: '批准',
    pillReject: '拒绝',
    pillStop: '停止',
    pillExpand: '展开',
    pillIdle: '待命中',

    previewBadge: '浏览器预览',
    previewViewCommand: '命令浮窗',
    previewViewPicker: '可视化拾取器',
    previewViewBorder: '视口边框',
    previewViewPill: '状态胶囊',
    previewSimApproval: '模拟审批',
    previewSimMissingBackend: '模拟缺后端',
  },
  'en-US': {
    appName: 'AEFlow',
    localeSwitchLabel: '中文',
    localeSwitchAria: '切换界面语言为简体中文',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save Config',
    saving: 'Saving...',
    saved: 'Saved',
    close: 'Close',
    retry: 'Retry',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    copyCommandAria: 'Copy install command',

    commandToolbarAria: 'AEFlow command controls',
    pickTargetPrompt: 'Select Target',
    addTarget: '+ Target',
    targetCountSuffix: 'targets',
    permAuto: 'Auto',
    permManual: 'Approve',
    permGroupAria: 'Execution permission mode',
    openStudio: 'Studio',
    settingsAria: 'Model & engine settings',
    collapseToPillAria: 'Collapse to status pill',
    hideWindowAria: 'Hide command popup',
    commandInputLabel: 'Enter a task instruction for AEFlow',
    commandPlaceholder: 'What do you want to do? // Type to start',
    sendActionAria: 'Send instruction',
    stopExecution: 'Stop',
    modeMinimal: 'CodeAct',
    modeGuarded: 'Guarded',
    dragHandleAria: 'Drag window',

    slashMenuAria: 'Slash commands',
    slashPickDesc: 'Open visual window & region picker',
    slashModeDesc: 'Toggle execution engine (CodeAct / Guarded)',
    slashPermDesc: 'Toggle permission mode (Auto / Manual Approval)',
    slashStudioDesc: 'Open full WebUI Studio in browser',
    slashSettingsDesc: 'Configure model, base URL, and API key',
    slashClearDesc: 'Clear active conversation stream',

    daemonConnecting: 'Connecting to local engine...',
    daemonAttached: 'Attached to local engine',
    daemonSpawned: 'Local engine ready',
    daemonDemoMode: 'Preview Mode',
    missingBackendTitle: 'Local AEFlow engine not found',
    missingBackendDesc: 'Install the lightweight Python backend via uv to bind desktop viewports and run tasks.',
    installViaUv: 'Install Backend via uv',
    installingViaUv: 'Installing via uv...',
    installUvHint: 'Or run in terminal:',
    installFailed: 'Installation failed',
    restartEngine: 'Restart Engine',

    configDrawerTitle: 'Quick Model Setup',
    configMissingKeyNotice: 'No API key configured yet. Add your model credentials to start automating.',
    providerPresetLabel: 'Provider Preset',
    providerCustom: 'Custom',
    modelLabel: 'Model Name',
    baseUrlLabel: 'Base URL',
    apiKeyLabel: 'API Key',
    apiKeyConfiguredPlaceholder: 'Configured (leave blank to keep)',
    apiKeyEmptyPlaceholder: 'Enter sk-... or compatible key',
    configSavedToast: 'Configuration saved',

    thinkingLabel: 'Reasoning',
    stepPrefix: 'Step',
    actionChipLabel: 'Action',
    approvalRequiredTitle: 'Approval Required',
    approveAction: 'Approve',
    rejectAction: 'Reject',
    statusRunning: 'Running',
    statusWaitingApproval: 'Approval',
    statusCompleted: 'Completed',
    statusAborted: 'Aborted',
    statusError: 'Error',
    youLabel: 'Prompt',
    agentLabel: 'AEFlow',
    clearConversation: 'Clear',
    noOutputYet: 'Observing bound viewport...',

    pickerToolbarAria: 'Visual target picker mode selector',
    pickerModeHover: 'Pick Window / Crop Region',
    pickerModeGrid: 'Thumbnail Grid (Tab)',
    pickerModeCdp: 'Headless Browser CDP',
    pickerEscHint: 'Esc to exit',
    pickerHoverGuide: 'Hover over any window and click to bind, or drag anywhere to crop a custom region',
    pickerDragRegionLabel: 'Custom Region',
    pickerRegionCustomTitle: 'Custom Region',
    pickerDisplaysSection: 'Displays',
    pickerWindowsSection: 'Application Windows',
    pickerEmptyTargets: 'No active displays or windows found',
    pickerSelectedCount: 'Selected',
    pickerBindSelected: 'Bind Target',
    pickerCdpTitle: 'Headless Browser Pages',
    pickerCdpRefresh: 'Refresh',
    pickerCdpEmptyTitle: 'No remote-debugging browser tabs found',
    pickerCdpEmptyDesc: 'Launch Chrome, Edge, or Electron with remote debugging enabled for true zero-interference background control.',
    pickerCdpLaunchHint: 'chrome --remote-debugging-port=9222',
    pickerCdpBackgroundBadge: 'Background Headless',
    pickerLoading: 'Scanning available targets...',
    pickerMinimizedBadge: 'Minimized',

    borderControlling: 'AEFlow Controlling',

    pillRunning: 'Running',
    pillStep: 'Step',
    pillApprovalNeeded: 'Approval needed',
    pillApprove: 'Approve',
    pillReject: 'Reject',
    pillStop: 'Stop',
    pillExpand: 'Expand',
    pillIdle: 'Idle',

    previewBadge: 'Browser Preview',
    previewViewCommand: 'Command',
    previewViewPicker: 'Visual Picker',
    previewViewBorder: 'Target Border',
    previewViewPill: 'Status Pill',
    previewSimApproval: 'Sim Approval',
    previewSimMissingBackend: 'Sim Missing UV',
  },
}
