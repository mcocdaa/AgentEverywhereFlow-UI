/**
 * Bilingual (EN / ZH) Translations for AgentEverywhereFlow WebUI Studio.
 */

export type Language = 'en' | 'zh'

export const translations = {
  en: {
    // Header
    'header.title': 'AgentEverywhereFlow Studio',
    'header.subtitle': 'Viewport-Isolated Embodied Console',
    'header.online': 'ONLINE',
    'header.offline': 'OFFLINE',
    'header.connecting': 'CONNECTING',
    'header.syncing': 'SYNCING',
    'header.noActiveSessions': 'No active sessions',
    'header.newSession': 'New Session',
    'header.mode': 'Mode',
    'header.permissionAuto': 'Auto',
    'header.permissionManual': 'Manual',
    'header.permissionAutoTooltip': 'Switch to Manual Approval Mode',
    'header.permissionManualTooltip': 'Switch to Autonomous Execution Mode',
    'header.export': 'Export',
    'header.exportTooltip': 'Export Trajectory as Workflow or Report',
    'header.reset': 'Reset',
    'header.resetTooltip': 'Clear Conversation History (Keeps Target Window)',
    'header.resetConfirm': 'Clear current session conversation history? (Viewport target remains bound)',
    'header.settings': 'Settings',
    'header.modelSettingsTooltip': 'Model & API Key Settings',
    'header.modelSettingsUnconfiguredTooltip': 'Model & API Key Settings (API Key not configured)',
    'header.language': 'Language',
    'header.langZh': '中文',
    'header.langEn': 'EN',

    // Sessions Dropdown & Management
    'sessions.search': 'Search sessions by title, target, or ID...',
    'sessions.noMatches': 'No matching sessions found',
    'sessions.rename': 'Rename session',
    'sessions.delete': 'Delete session',
    'sessions.deleteConfirm': 'Delete this session? Recorded trajectory will be removed.',
    'sessions.active': 'Active',
    'sessions.total': 'Total {count} sessions',
    'sessions.new': 'New Session',
    'sessions.turns': 'turns',
    'sessions.steps': 'steps',
    'sessions.save': 'Save',
    'sessions.cancel': 'Cancel',
    'sessions.editTitle': 'Edit title',
    'sessions.confirmDelete': 'Confirm Delete',

    // Viewport Monitor
    'viewport.title': 'Viewport Monitor',
    'viewport.noTarget': 'No Target Window Bound',
    'viewport.noTargetDesc': 'Select a physical display, application window, custom region, or headless browser tab to begin.',
    'viewport.selectTarget': 'Select Target (+ New Session)',
    'viewport.locked': 'Locked',
    'viewport.autoRefresh': 'Auto-Refresh (2s)',
    'viewport.manualRefresh': 'Refresh Viewport Snapshot',
    'viewport.fullscreen': 'Fullscreen',
    'viewport.exitFullscreen': 'Exit Fullscreen',
    'viewport.loading': 'Loading viewport capture...',
    'viewport.switchTarget': 'Switch bound target',
    'viewport.switchingTarget': 'Switching target...',
    'viewport.boundPool': 'Session Target Pool',
    'viewport.availableTargets': 'Available Displays & Windows',
    'viewport.refreshTargets': 'Refresh available targets',
    'viewport.noTargetsAvailable': 'No switchable targets found.',
    'viewport.switchTargetError': 'Failed to switch target.',
    'viewport.targetCount': '{count} targets',

    // Dialogue Stream
    'stream.title': 'Dialogue Stream',
    'stream.sessionReady': 'Session Ready',
    'stream.sessionReadyDesc': 'Type an instruction below (e.g. "Click search bar, type query, and press Enter") to initiate the agent loop.',
    'stream.operator': 'OPERATOR',
    'stream.agentReasoning': 'Agent Reasoning / Chain-of-Thought',
    'stream.streaming': 'Streaming',
    'stream.step': 'Step',
    'stream.executingCodeAct': 'Executing CodeAct Action Block',
    'stream.action': 'Action',
    'stream.actionsSuccess': 'Actions Executed Successfully',
    'stream.actionRejected': 'Action Rejected by Operator',
    'stream.executionFailed': 'Execution Failed',
    'stream.taskCompleted': 'TASK COMPLETED',
    'stream.goalReached': 'Goal successfully reached.',
    'stream.executionAborted': 'EXECUTION ABORTED',
    'stream.abortedDesc': 'Current turn stopped immediately. The target window and session remain ready for your next instruction.',
    'stream.abortedDefault': 'Execution aborted by operator.',
    'stream.executionError': 'EXECUTION ERROR',
    'stream.executing': 'Agent is reasoning and executing actions...',
    'stream.toolCall': 'Tool Call',
    'stream.agent': 'Agent',
    'stream.agentMessage': 'Agent Message',
    'stream.stdout': 'STDOUT',
    'stream.errorTrace': 'ERROR TRACE',

    // Prompt Input
    'prompt.quick1': 'Inspect active window layout and summarize UI',
    'prompt.quick2': 'Click the primary search bar or input field',
    'prompt.quick3': 'Take a fresh screenshot and check for error dialogs',
    'prompt.placeholderIdle': 'Instruct the agent (e.g. "Click the search bar, type query, and press Enter")...',
    'prompt.placeholderExecuting': 'Agent executing actions... (Hit Stop to abort or wait for completion)',
    'prompt.placeholderDisabled': 'Select or create a session above to start...',
    'prompt.maxSteps': 'Max Steps:',
    'prompt.steps20': '20 steps',
    'prompt.steps50': '50 steps',
    'prompt.steps100': '100 steps',
    'prompt.stop': 'Stop',

    // New Session Modal & Visual Target Picker
    'newSession.title': 'Create New Agent Session',
    'newSession.subtitle': 'Choose a live screen, window, region, or headless browser tab',
    'newSession.close': 'Close dialog',
    'newSession.selectTarget': '1. Select Capture Target',
    'newSession.targetSourceTabs': 'Capture target sources',
    'newSession.tabScreensWindows': 'Screens & Windows',
    'newSession.tabRegion': 'Custom Region',
    'newSession.tabCdp': 'Headless Browser (CDP)',
    'newSession.all': 'All',
    'newSession.windows': 'Windows',
    'newSession.displays': 'Displays',
    'newSession.refreshTargets': 'Refresh targets',
    'newSession.updated': 'Updated',
    'newSession.discovering': 'Discovering active windows and displays...',
    'newSession.noTargets': 'No targets found.',
    'newSession.minimized': 'Minimized',
    'newSession.untitledTarget': 'Untitled Target',
    'newSession.studioBadge': 'STUDIO',
    'newSession.multiSelectedBadge': '{count} targets selected (Multi-Target Pool)',
    'newSession.clearSelection': 'Single mode',
    'newSession.toggleTargetCheck': 'Include in multi-target pool',
    'newSession.previewUnavailable': 'Live preview unavailable',
    'newSession.regionX': 'X (px)',
    'newSession.regionY': 'Y (px)',
    'newSession.regionWidth': 'Width (px)',
    'newSession.regionHeight': 'Height (px)',
    'newSession.regionTitle': 'Region Label (Optional)',
    'newSession.regionTitlePlaceholder': 'e.g. Trading Chart Panel',
    'newSession.regionPresets': 'Quick Presets',
    'newSession.regionSummary': 'Isolated crop viewport',
    'newSession.regionInvalidError': 'Width and height must each be at least 64 px.',
    'newSession.cdpEndpointLabel': 'Debug Endpoint',
    'newSession.cdpEndpointPlaceholder': 'http://127.0.0.1:9222',
    'newSession.cdpScan': 'Scan Tabs',
    'newSession.cdpScanning': 'Scanning local browser tabs...',
    'newSession.cdpNoTabs': 'No debuggable Chrome, Edge, or Electron tabs detected.',
    'newSession.cdpTipTitle': 'Zero-interference background control',
    'newSession.cdpTipDesc': 'Launch Chromium with remote debugging to click and type without stealing focus or cursor:',
    'newSession.cdpCopyCmd': 'Copy launch flag',
    'newSession.cdpCopied': 'Copied',
    'newSession.cdpFetchError': 'Failed to discover CDP browser tabs.',
    'newSession.cdpSelectError': 'Please select a browser tab to bind.',
    'newSession.executionMode': '2. Execution Engine Mode',
    'newSession.modeMinimal': 'Minimal Mode (CodeAct)',
    'newSession.modeMinimalBadge': 'Minimal',
    'newSession.modeMinimalDesc': 'Executes Python REPL code blocks directly in an isolated runtime.',
    'newSession.modeGuarded': 'Guarded Mode (JSON Tools)',
    'newSession.modeGuardedBadge': 'Guarded',
    'newSession.modeGuardedDesc': 'Structured tool calls validated against strict viewport boundaries and safety rules.',
    'newSession.targetTypeDisplay': 'display',
    'newSession.targetTypeWindow': 'window',
    'newSession.targetTypeRegion': 'region',
    'newSession.targetTypeCdp': 'cdp',
    'newSession.permissionMode': '3. Security & Permission Gate',
    'newSession.permAuto': 'Autonomous (Auto)',
    'newSession.permAutoDesc': 'Runs full multi-step loop without pausing for manual approvals.',
    'newSession.permManual': 'Manual Approval Gate',
    'newSession.permManualDesc': 'Pauses on every keyboard/mouse action for human confirmation in Studio.',
    'newSession.cancel': 'Cancel',
    'newSession.launchSession': 'Launch Session',
    'newSession.launchMultiSession': 'Launch ({count} Targets)',
    'newSession.bindingSession': 'Binding Session...',
    'newSession.selectTargetError': 'Please select at least one target window or screen.',
    'newSession.fetchTargetsError': 'Failed to fetch targets',
    'newSession.createSessionError': 'Failed to create session',

    // Model & App Settings Modal
    'settings.title': 'Model & Runtime Settings',
    'settings.subtitle': 'Configure VLM provider, API key, and session defaults',
    'settings.close': 'Close settings',
    'settings.loading': 'Loading runtime configuration...',
    'settings.providerPresets': 'Provider Presets',
    'settings.providerOpenAI': 'OpenAI',
    'settings.providerDeepSeek': 'DeepSeek',
    'settings.providerOpenRouter': 'OpenRouter',
    'settings.providerOllama': 'Ollama',
    'settings.providerCustom': 'Custom',
    'settings.baseUrl': 'Base URL',
    'settings.baseUrlPlaceholder': 'https://api.openai.com/v1',
    'settings.modelName': 'Model Name',
    'settings.modelNamePlaceholder': 'gpt-4o',
    'settings.apiKey': 'API Key',
    'settings.apiKeyConfigured': 'Configured',
    'settings.apiKeyNotSet': 'Not configured',
    'settings.apiKeyPlaceholderSet': 'Leave blank to keep existing key, or paste a new key',
    'settings.apiKeyPlaceholderUnset': 'Paste your provider API key (sk-...)',
    'settings.apiKeyHint': 'Write-only field. Stored securely in your local AEFlow profile and never returned in plaintext.',
    'settings.showApiKey': 'Show API key',
    'settings.hideApiKey': 'Hide API key',
    'settings.defaultMode': 'Default Execution Mode',
    'settings.defaultPermission': 'Default Permission Mode',
    'settings.summonHotkey': 'Global Summon Hotkey',
    'settings.summonHotkeyDesc': 'Used by AEFlow Desktop companion to summon anywhere',
    'settings.cancel': 'Cancel',
    'settings.save': 'Save Configuration',
    'settings.saving': 'Saving...',
    'settings.saved': 'Configuration saved and applied.',
    'settings.loadError': 'Unable to load runtime configuration from backend.',
    'settings.saveError': 'Failed to save configuration.',
    'settings.validationBaseUrl': 'Please enter a valid provider Base URL.',
    'settings.validationModel': 'Please enter a model name.',

    // Export Modal
    'export.title': 'Export Automation Workflow',
    'export.subtitle': 'Export session actions as executable automation or audit report',
    'export.tabPython': 'Python CodeAct Script',
    'export.tabYaml': 'YAML Workflow Spec',
    'export.tabMarkdown': 'Audit Markdown Report',
    'export.tabJson': 'JSON Trace',
    'export.dryRunReplay': 'Dry-Run Replay',
    'export.validating': 'Validating...',
    'export.dryRunValidated': '✓ Dry-Run validated ({count} steps ready)',
    'export.replayedSuccess': '✓ Replayed {count} steps successfully',
    'export.workflowStatus': '⚠ Workflow status: {status}',
    'export.replayFailed': 'Replay request failed',
    'export.error': 'Replay request failed',
    'export.eventsRecorded': '{count} session events recorded',
    'export.copy': 'Copy Code',
    'export.copied': 'Copied!',
    'export.download': 'Download File',
    'export.close': 'Close',

    // Endpoint Modal
    'endpoint.title': 'Backend Endpoint Settings',
    'endpoint.subtitle': 'Configure connection to AEFlow service',
    'endpoint.apiUrl': 'Service Endpoint URL',
    'endpoint.apiDesc': "Defaults to current origin (or http://127.0.0.1:8000). Set a custom URL if connecting to a separate 'aef serve --port <port>' instance.",
    'endpoint.test': 'Test',
    'endpoint.quickPresets': 'Quick Presets',
    'endpoint.port': 'Port {port}',
    'endpoint.resetAuto': 'Reset to Auto Proxy',
    'endpoint.cancel': 'Cancel',
    'endpoint.save': 'Save & Apply',
    'endpoint.testing': 'Testing connectivity to endpoint...',
    'endpoint.connected': 'Connected to AEFlow v{version} successfully!',
    'endpoint.failed': 'Connection failed: {msg}. Make sure "aef serve" is running.',

    // Approval Gate
    'approval.title': 'Operator Approval Required',
    'approval.subtitle': 'Agent proposed OS input injection',
    'approval.action': 'ACTION:',
    'approval.placeholder': 'Optional reason for agent correction...',
    'approval.approve': 'Approve Action',
    'approval.reject': 'Reject...',
    'approval.confirmReject': 'Confirm Reject',

    // Header Tooltips
    'header.offlineTooltip': 'Backend daemon offline. Click to check port or endpoint settings.',
    'header.onlineIdleTooltip': 'Backend daemon is online. Click to change backend endpoint.',
    'header.onlineConnectedTooltip': 'Session stream connected. Click to change backend endpoint.',
    'header.syncingTooltip': 'Connecting session stream...',
    'header.connectingTooltip': 'Session stream reconnecting...',
  },
  zh: {
    // Header
    'header.title': 'AgentEverywhereFlow 工作台',
    'header.subtitle': '视口隔离具身智能体控制台',
    'header.online': '在线',
    'header.offline': '离线',
    'header.connecting': '连接中',
    'header.syncing': '同步中',
    'header.noActiveSessions': '暂无活动会话',
    'header.newSession': '新建会话',
    'header.mode': '模式',
    'header.permissionAuto': '自主模式',
    'header.permissionManual': '人工审批',
    'header.permissionAutoTooltip': '点击切换为人工单步审批模式',
    'header.permissionManualTooltip': '点击切换为完全自主执行模式',
    'header.export': '导出',
    'header.exportTooltip': '将会话动作导出为自动化脚本或审计报告',
    'header.reset': '重置',
    'header.resetTooltip': '清空当前会话对话上下文（保持目标窗口绑定）',
    'header.resetConfirm': '确认清空当前会话的对话历史？（目标窗口的绑定视口将继续保留）',
    'header.settings': '设置',
    'header.modelSettingsTooltip': '模型与 API 密钥设置',
    'header.modelSettingsUnconfiguredTooltip': '模型与 API 密钥设置（尚未配置密钥）',
    'header.language': '语言',
    'header.langZh': '中文',
    'header.langEn': 'EN',
    'header.offlineTooltip': '后端服务离线，点击检查端口或连接地址。',
    'header.onlineIdleTooltip': '后端服务在线，点击切换后端服务地址。',
    'header.onlineConnectedTooltip': '会话实时事件流已连接，点击切换后端服务地址。',
    'header.syncingTooltip': '正在同步连接会话流...',
    'header.connectingTooltip': '正在重新连接会话流...',

    // Sessions Dropdown & Management
    'sessions.search': '搜索会话名称、目标或 ID...',
    'sessions.noMatches': '未找到匹配的会话',
    'sessions.rename': '修改会话名称',
    'sessions.delete': '删除会话',
    'sessions.deleteConfirm': '确定要彻底删除该会话吗？已记录的执行历史将被清除。',
    'sessions.active': '当前',
    'sessions.total': '共 {count} 个会话',
    'sessions.new': '新建会话',
    'sessions.turns': '轮次',
    'sessions.steps': '步',
    'sessions.save': '保存',
    'sessions.cancel': '取消',
    'sessions.editTitle': '编辑标题',
    'sessions.confirmDelete': '确认删除',

    // Viewport Monitor
    'viewport.title': '视口隔离监视器',
    'viewport.noTarget': '未绑定目标窗口',
    'viewport.noTargetDesc': '请选择物理显示器、应用窗口、自定义区域或无头浏览器标签页以开始隔离感知与操作。',
    'viewport.selectTarget': '选择目标 (+ 新建会话)',
    'viewport.locked': '目标锁定',
    'viewport.autoRefresh': '自动刷新 (2s)',
    'viewport.manualRefresh': '刷新视口快照',
    'viewport.fullscreen': '全屏监视',
    'viewport.exitFullscreen': '退出全屏',
    'viewport.loading': '正在加载视口画面...',
    'viewport.switchTarget': '切换绑定目标',
    'viewport.switchingTarget': '正在切换目标...',
    'viewport.boundPool': '当前会话目标池',
    'viewport.availableTargets': '可用屏幕与窗口',
    'viewport.refreshTargets': '刷新可用目标列表',
    'viewport.noTargetsAvailable': '暂无可切换的目标。',
    'viewport.switchTargetError': '切换目标失败。',
    'viewport.targetCount': '{count} 个目标',

    // Dialogue Stream
    'stream.title': '对话流',
    'stream.sessionReady': '会话就绪',
    'stream.sessionReadyDesc': '在下方输入任务指令（例如：“点击搜索栏，输入关键词并按回车”），即可开启智能体任务循环。',
    'stream.operator': '操作员',
    'stream.agentReasoning': '智能体推理 / 思维链',
    'stream.streaming': '实时输出',
    'stream.step': '步骤',
    'stream.executingCodeAct': '正在执行 CodeAct 动作块',
    'stream.action': '执行动作',
    'stream.actionsSuccess': '动作执行成功',
    'stream.actionRejected': '操作已被操作员拒绝',
    'stream.executionFailed': '执行出错',
    'stream.taskCompleted': '任务已完成',
    'stream.goalReached': '任务目标已顺利达成。',
    'stream.executionAborted': '执行已中止',
    'stream.abortedDesc': '当前轮次已立即终止。目标窗口及会话环境保持就绪，可随时接收下一条指令。',
    'stream.abortedDefault': '操作员已中止执行。',
    'stream.executionError': '执行发生异常',
    'stream.executing': '智能体正在推理并执行动作...',
    'stream.toolCall': '工具调用',
    'stream.agent': '智能体',
    'stream.agentMessage': '智能体回应',
    'stream.stdout': '标准输出',
    'stream.errorTrace': '异常追踪',

    // Prompt Input
    'prompt.quick1': '分析当前窗口界面布局与主要元素',
    'prompt.quick2': '点击主搜索栏或文本输入框',
    'prompt.quick3': '截取最新快照并检查有无错误弹窗',
    'prompt.placeholderIdle': '向智能体下达指令（例如：“点击搜索栏，输入内容并按回车”）...',
    'prompt.placeholderExecuting': '智能体正在执行动作...（可点击中断停止，或等待完成）',
    'prompt.placeholderDisabled': '请先在上方选择或创建会话...',
    'prompt.maxSteps': '最大步数:',
    'prompt.steps20': '20 步',
    'prompt.steps50': '50 步',
    'prompt.steps100': '100 步',
    'prompt.stop': '中断',

    // New Session Modal & Visual Target Picker
    'newSession.title': '创建具身智能体新会话',
    'newSession.subtitle': '可视化选择屏幕、应用窗口、自定义区域或无头浏览器标签页',
    'newSession.close': '关闭弹窗',
    'newSession.selectTarget': '1. 选择捕获与操作目标',
    'newSession.targetSourceTabs': '捕获目标类型',
    'newSession.tabScreensWindows': '屏幕与窗口',
    'newSession.tabRegion': '自定义区域',
    'newSession.tabCdp': '无头浏览器 (CDP)',
    'newSession.all': '全部',
    'newSession.windows': '窗口',
    'newSession.displays': '屏幕',
    'newSession.refreshTargets': '刷新目标列表',
    'newSession.updated': '已更新',
    'newSession.discovering': '正在扫描活动窗口与显示器...',
    'newSession.noTargets': '未发现可用目标窗口。',
    'newSession.minimized': '最小化',
    'newSession.untitledTarget': '未命名窗口',
    'newSession.studioBadge': '工作台',
    'newSession.multiSelectedBadge': '已勾选 {count} 个目标（多目标池）',
    'newSession.clearSelection': '恢复单选',
    'newSession.toggleTargetCheck': '加入多目标池',
    'newSession.previewUnavailable': '暂不支持实时缩略图',
    'newSession.regionX': '起点 X (px)',
    'newSession.regionY': '起点 Y (px)',
    'newSession.regionWidth': '宽度 (px)',
    'newSession.regionHeight': '高度 (px)',
    'newSession.regionTitle': '区域名称（选填）',
    'newSession.regionTitlePlaceholder': '例如：行情图表区域',
    'newSession.regionPresets': '快捷尺寸预设',
    'newSession.regionSummary': '隔离裁剪视口',
    'newSession.regionInvalidError': '区域宽度与高度均须不少于 64 像素。',
    'newSession.cdpEndpointLabel': '调试端口地址',
    'newSession.cdpEndpointPlaceholder': 'http://127.0.0.1:9222',
    'newSession.cdpScan': '扫描标签页',
    'newSession.cdpScanning': '正在扫描本地浏览器标签页...',
    'newSession.cdpNoTabs': '未检测到开放调试端口的 Chrome、Edge 或 Electron 标签页。',
    'newSession.cdpTipTitle': '零干扰后台无头操控',
    'newSession.cdpTipDesc': '使用远程调试参数启动浏览器后，即可在后台静默点击与输入，不抢占光标与焦点：',
    'newSession.cdpCopyCmd': '复制启动参数',
    'newSession.cdpCopied': '已复制',
    'newSession.cdpFetchError': '扫描 CDP 浏览器标签页失败。',
    'newSession.cdpSelectError': '请先选择一个要绑定的浏览器标签页。',
    'newSession.executionMode': '2. 执行引擎模式',
    'newSession.modeMinimal': '极简模式 (CodeAct)',
    'newSession.modeMinimalBadge': '极简执行',
    'newSession.modeMinimalDesc': '在隔离运行环境中直接执行 Python REPL 代码块。',
    'newSession.modeGuarded': '受控模式 (JSON 工具)',
    'newSession.modeGuardedBadge': '受控审批',
    'newSession.modeGuardedDesc': '返回结构化工具调用，通过严格的视口边界与安全规则校验后执行。',
    'newSession.targetTypeDisplay': '显示器',
    'newSession.targetTypeWindow': '窗口',
    'newSession.targetTypeRegion': '区域',
    'newSession.targetTypeCdp': '无头页',
    'newSession.permissionMode': '3. 安全与权限门禁',
    'newSession.permAuto': '自主执行 (Auto)',
    'newSession.permAutoDesc': '连续运行多步感知与操作循环，无需暂停等待人工确认。',
    'newSession.permManual': '人工审批门禁',
    'newSession.permManualDesc': '每次键鼠注入动作前暂停，需操作员在工作台确认批准后执行。',
    'newSession.cancel': '取消',
    'newSession.launchSession': '启动会话',
    'newSession.launchMultiSession': '启动会话（{count} 个目标）',
    'newSession.bindingSession': '正在绑定会话...',
    'newSession.selectTargetError': '请至少选择一个目标窗口或显示屏幕。',
    'newSession.fetchTargetsError': '获取目标列表失败',
    'newSession.createSessionError': '创建会话失败',

    // Model & App Settings Modal
    'settings.title': '模型与运行配置',
    'settings.subtitle': '配置视觉大模型服务商、API 密钥与默认执行策略',
    'settings.close': '关闭设置',
    'settings.loading': '正在读取运行配置...',
    'settings.providerPresets': '服务商快捷预设',
    'settings.providerOpenAI': 'OpenAI',
    'settings.providerDeepSeek': 'DeepSeek',
    'settings.providerOpenRouter': 'OpenRouter',
    'settings.providerOllama': 'Ollama 本地',
    'settings.providerCustom': '自定义',
    'settings.baseUrl': '接口基础地址 (Base URL)',
    'settings.baseUrlPlaceholder': 'https://api.openai.com/v1',
    'settings.modelName': '视觉模型名称',
    'settings.modelNamePlaceholder': 'gpt-4o',
    'settings.apiKey': 'API 密钥',
    'settings.apiKeyConfigured': '已配置',
    'settings.apiKeyNotSet': '未配置',
    'settings.apiKeyPlaceholderSet': '留空保持当前密钥，或粘贴新密钥以覆盖',
    'settings.apiKeyPlaceholderUnset': '粘贴服务商 API 密钥 (sk-...)',
    'settings.apiKeyHint': '仅写入不回显明文，将安全保存至本地 AEFlow 配置文件。',
    'settings.showApiKey': '显示密钥',
    'settings.hideApiKey': '隐藏密钥',
    'settings.defaultMode': '默认执行引擎',
    'settings.defaultPermission': '默认权限模式',
    'settings.summonHotkey': '全局召唤快捷键',
    'settings.summonHotkeyDesc': '用于 AEFlow Desktop 桌面端随处一键唤起',
    'settings.cancel': '取消',
    'settings.save': '保存配置',
    'settings.saving': '保存中...',
    'settings.saved': '配置已保存并即时生效。',
    'settings.loadError': '无法从后端读取运行配置，请确认后端已更新并正常运行。',
    'settings.saveError': '保存配置失败。',
    'settings.validationBaseUrl': '请填写有效的服务商基础地址。',
    'settings.validationModel': '请填写模型名称。',

    // Export Modal
    'export.title': '导出自动化工作流',
    'export.subtitle': '将会话动作轨迹导出为可执行自动化脚本或审计报告',
    'export.tabPython': 'Python CodeAct 脚本',
    'export.tabYaml': 'YAML 工作流规范',
    'export.tabMarkdown': '审计 Markdown 报告',
    'export.tabJson': 'JSON 轨迹',
    'export.dryRunReplay': '预演回放',
    'export.validating': '正在校验...',
    'export.dryRunValidated': '✓ 预演校验通过（{count} 步就绪）',
    'export.replayedSuccess': '✓ 成功回放 {count} 个步骤',
    'export.workflowStatus': '⚠ 工作流状态: {status}',
    'export.replayFailed': '预演回放请求失败',
    'export.error': '预演回放请求失败',
    'export.eventsRecorded': '已记录 {count} 条会话事件',
    'export.copy': '复制代码',
    'export.copied': '已复制!',
    'export.download': '下载文件',
    'export.close': '关闭',

    // Endpoint Modal
    'endpoint.title': '后端服务连接设置',
    'endpoint.subtitle': '配置与 AEFlow 服务的连接参数',
    'endpoint.apiUrl': '服务端点地址 (URL)',
    'endpoint.apiDesc': "默认自动跟随当前访问源（或 http://127.0.0.1:8000）。若连接到独立后端，请设置为 'aef serve --port <port>' 所指定的地址。",
    'endpoint.test': '测试连接',
    'endpoint.quickPresets': '快捷端口预设',
    'endpoint.port': '端口 {port}',
    'endpoint.resetAuto': '恢复默认自动代理',
    'endpoint.cancel': '取消',
    'endpoint.save': '保存并应用',
    'endpoint.testing': '正在测试与后端的连通性...',
    'endpoint.connected': '成功连接到 AEFlow v{version}！',
    'endpoint.failed': '连接失败: {msg}。请确保已运行 "aef serve"。',

    // Approval Gate
    'approval.title': '需要操作员审批',
    'approval.subtitle': '智能体申请注入系统键鼠输入',
    'approval.action': '操作类型:',
    'approval.placeholder': '输入拒绝原因或纠错指导（选填）...',
    'approval.approve': '批准执行',
    'approval.reject': '拒绝...',
    'approval.confirmReject': '确认拒绝',
  },
} as const

export type TranslationKey = keyof typeof translations.en

/**
 * Localize dynamic capture target titles (e.g. "Display 1 (2560x1600)" <-> "显示器 1 (2560x1600)")
 * based on active UI language.
 */
export function formatTargetTitle(title: string | undefined | null, language: Language): string {
  if (!title) return ''
  if (language === 'zh') {
    return title
      .replace(/^Display\s+(\d+)\b/i, '显示器 $1')
      .replace(/\bDisplay\s+(\d+)\s*\(/gi, '显示器 $1 (')
      .replace(/^Primary Display\b/i, '主显示器')
      .replace(/^Region\s*\(/i, '自定义区域 (')
      .replace('Excel Q4 Revenue SUM', 'Excel 第四季度营收汇总')
      .replace('Chrome - Q4 Financial Dashboard', 'Chrome - 第四季度财务看板')
      .replace('AgentEverywhereFlow Studio', 'AgentEverywhereFlow 工作台')
      .replace(/[（(]\s*Verified\s*[)）]/gi, '(已核验)')
      .replace(/[（(]\s*Audited\s*[)）]/gi, '(已审计)')
      .replace(/[（(]\s*Completed\s*[)）]/gi, '(已完成)')
      .replace(/\bVerified\b/gi, '已核验')
  }
  return title
    .replace(/^显示器\s*(\d+)/, 'Display $1')
    .replace(/显示器\s*(\d+)\s*\(/g, 'Display $1 (')
    .replace(/^主显示器/, 'Primary Display')
    .replace(/^自定义区域\s*\(/, 'Region (')
    .replace('Excel 第四季度营收汇总', 'Excel Q4 Revenue SUM')
    .replace('Chrome - 第四季度财务看板', 'Chrome - Q4 Financial Dashboard')
    .replace('AgentEverywhereFlow 工作台', 'AgentEverywhereFlow Studio')
    .replace(/[（(]\s*已核验\s*[)）]/g, '(Verified)')
    .replace(/[（(]\s*已审计\s*[)）]/g, '(Audited)')
    .replace(/[（(]\s*已完成\s*[)）]/g, '(Completed)')
    .replace(/已核验/g, 'Verified')
}

const EVENT_TEXT_PAIRS: ReadonlyArray<[string, string]> = [
  [
    'Calculate the total cost of all hardware items in D2:D6 and enter the SUM formula in cell D7.',
    '计算 D2:D6 区域所有硬件项目的总成本，并在 D7 单元格中输入 SUM 求和公式。',
  ],
  [
    "[Observe] Isolated viewport (560×440) captured for 'Excel - Q4_Sales.xlsx'. Table A1:D7 lists 5 hardware items with cost column D2:D6.\n[Thought] Focus target cell D7 at (330, 261), inject '=SUM(D2:D6)', and press Enter.",
    "[观察] 已捕获 'Excel - Q4_Sales.xlsx' 的隔离视口 (560×440)。表格 A1:D7 列出 5 项硬件及成本列 D2:D6。\n[思考] 聚焦目标单元格 D7 (330, 261)，注入公式 '=SUM(D2:D6)' 并按回车确认。",
  ],
  [
    "Inject formula '=SUM(D2:D6)' into cell D7 (330, 261) and press Enter",
    "在单元格 D7 (330, 261) 注入公式 '=SUM(D2:D6)' 并按回车执行",
  ],
  [
    'Entered =SUM(D2:D6) into cell D7 and verified the total hardware cost across D2:D6 (131,978).',
    '已在单元格 D7 输入 =SUM(D2:D6)，并校验 D2:D6 硬件总成本为 131,978。',
  ],
  [
    'Inspect active window layout and summarize UI',
    '分析当前窗口界面布局与主要元素',
  ],
  [
    'Click the primary search bar or input field',
    '点击主搜索栏或文本输入框',
  ],
  [
    'Take a fresh screenshot and check for error dialogs',
    '截取最新快照并检查有无错误弹窗',
  ],
  ['Cell D7 Focused', '已聚焦单元格 D7'],
  ['Formula Injected', '已注入公式'],
  ['Evaluated: 131978', '计算结果: 131978'],
  ['Execution aborted by operator.', '操作员已中止执行。'],
]

const EVENT_EN_TO_ZH_MAP: Record<string, string> = Object.fromEntries(EVENT_TEXT_PAIRS)
const EVENT_ZH_TO_EN_MAP: Record<string, string> = Object.fromEntries(
  EVENT_TEXT_PAIRS.map(([en, zh]) => [zh, en])
)

/**
 * Localize dynamic session event texts or descriptions when switching between EN and ZH.
 */
export function formatEventText(text: string | undefined | null, language: Language): string {
  if (!text) return ''
  const normalized = text.replace(/\r\n/g, '\n')
  if (language === 'zh') {
    if (EVENT_EN_TO_ZH_MAP[normalized]) {
      return EVENT_EN_TO_ZH_MAP[normalized]
    }
    let out = normalized
    for (const [en, zh] of EVENT_TEXT_PAIRS) {
      if (out.includes(en)) {
        out = out.split(en).join(zh)
      }
    }
    return formatTargetTitle(out, language)
  }
  if (EVENT_ZH_TO_EN_MAP[normalized]) {
    return EVENT_ZH_TO_EN_MAP[normalized]
  }
  let out = normalized
  for (const [en, zh] of EVENT_TEXT_PAIRS) {
    if (out.includes(zh)) {
      out = out.split(zh).join(en)
    }
  }
  return formatTargetTitle(out, language)
}
