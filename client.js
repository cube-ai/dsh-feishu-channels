/**
 * dsh-feishu-channels 浏览器端：飞书频道设置页 + 工作区频道槽。
 */
window.__ModuleLoader__.load({
  id: "@cubeai/dsh-feishu-channels",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");
    const { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, useSyncExternalStore } = React;
    let ReactDOM = {};
    try { ReactDOM = require("react-dom"); } catch { /* react-dom is optional; SVG markup degrades gracefully */ }
    const primitives = typeof require === "function" ? (function () { try { return require("@deepseek-ai/dsh-client-ui-primitives"); } catch { return {}; } })() : {};
    const PrimitiveButton = primitives.Button;
    const HostMenu = primitives.Menu || function FallbackMenu(props) {
      const items = Array.isArray(props.items) ? props.items : [];
      const footer = Array.isArray(props.footer) ? props.footer : [];
      const option = (item) => React.createElement("button", {
        key: String(item.value),
        type: "button",
        role: "option",
        disabled: item.disabled,
        "aria-selected": props.selectedId !== undefined && String(item.value) === String(props.selectedId),
        style: {
          display: "block",
          width: "100%",
          padding: "6px 8px",
          border: 0,
          borderRadius: 6,
          background: props.selectedId !== undefined && String(item.value) === String(props.selectedId) ? "var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06))" : "transparent",
          color: "var(--dsw-alias-label-primary, inherit)",
          textAlign: "left",
          cursor: item.disabled ? "not-allowed" : "pointer",
          opacity: item.disabled ? 0.5 : 1,
        },
        onClick: () => {
          if (item.disabled) return;
          props.onSelect?.(item.value);
          props.onClose?.();
        },
      }, item.label);
      return React.createElement("div", { className: "dfc-fallback-menu-wrap", style: { position: "relative", display: "inline-flex", width: "100%" } },
        props.anchor,
        props.open && React.createElement("div", {
          className: ["dfc-form-menu", props.listClassName].filter(Boolean).join(" "),
          role: "listbox",
          style: {
            position: "absolute",
            zIndex: 1200,
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            maxHeight: 280,
            overflow: "auto",
            background: "var(--dsw-alias-bg-layer-2, #fff)",
            border: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.12))",
            borderRadius: 8,
            padding: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,.16)",
          },
        }, items.map(option), footer.map(option)));
    };
    const HostModal = primitives.Modal;
    const HostSegmentedTabs = primitives.SegmentedTabs || function FallbackSegmentedTabs(props) {
      return React.createElement("div", {
        className: [props.className, "dfc-tabs"].filter(Boolean).join(" "),
        role: "tablist",
        "aria-label": props.label,
      }, (props.items || []).map((item) => React.createElement("button", {
        key: item.value,
        type: "button",
        role: "tab",
        "aria-selected": item.value === props.value,
        className: item.value === props.value ? "dfc-tab on" : "dfc-tab",
        onClick: () => props.onChange(item.value),
      }, item.label)));
    };
    // 宿主 Button 由 forwardRef 包成对象，typeof 是 object，不是 function。
    function isHostComponent(component) {
      return typeof component === "function" || (!!component && typeof component === "object" && typeof component.render === "function");
    }
    // 只关最上层。下层监听先注册，不是顶层就放行，避免一次 Escape 关掉弹窗和宿主设置。
    const modalLayers = [];
    // 0.1.7 把尺寸从图标名里拿掉了（IconEditOutlineRegular）。旧宿主仍导出 *16/*20。
    function pickHostIcon(...names) {
      for (const name of names) {
        const icon = primitives[name];
        if (typeof icon === "function") return icon;
      }
      return function MissingHostIcon() { return null; };
    }
    const IconFolderClose = pickHostIcon("IconFolderCloseRegular", "IconFolderClose16", "IconFolderClose");
    const IconClockOutline = pickHostIcon("IconClockOutlineRegular", "IconClockOutline16");
    const IconQueueOutline = pickHostIcon("IconQueueOutlineRegular");
    const IconCheckOutline = pickHostIcon("IconCheckOutlineRegular");
    const IconCheckCircleOutline = pickHostIcon("IconCheckCircleOutlineRegular");
    const IconCloseCircleFill = pickHostIcon("IconCloseCircleFillRegular");
    const IconInfoOutline = pickHostIcon("IconInfoOutlineRegular");
    const IconWarningOutline = pickHostIcon("IconWarningOutlineRegular");
    const IconCloseFill = pickHostIcon("IconCloseFillRegular");
    const IconChevronDownOutline = pickHostIcon("IconChevronDownOutlineRegular");
    const IconChevronRightOutline = pickHostIcon("IconChevronRightOutlineRegular");
    const IconPlusOutline = pickHostIcon("IconPlusOutlineRegular");
    const IconEditOutline = pickHostIcon("IconEditOutlineRegular");
    const IconRefreshOutline = pickHostIcon("IconRefreshOutlineRegular");
    const IconDownloadOutline = pickHostIcon("IconDownloadOutlineRegular");
    const IconCopyOutline = pickHostIcon("IconCopyOutlineRegular");
    const IconLoadingOutline = pickHostIcon("IconLoadingOutlineRegular");
    function alertIcon(type) {
      if (type === "success") return h(IconCheckCircleOutline, { size: 14 });
      if (type === "warning") return h(IconWarningOutline, { size: 14 });
      if (type === "error") return h(IconCloseCircleFill, { size: 14 });
      return h(IconInfoOutline, { size: 14 });
    }
    function NoticeBar({ type = "info", icon, children, className, role, showIcon }) {
      const iconNode = icon !== undefined ? icon : (showIcon !== false ? alertIcon(type) : null);
      return React.createElement("div", {
        role: role || (type === "error" ? "alert" : undefined),
        className: ["dfc-feedback", "dfc-feedback-" + type, className].filter(Boolean).join(" "),
      },
        iconNode && React.createElement("span", { className: "dfc-feedback-icon" }, iconNode),
        React.createElement("div", { className: "dfc-feedback-body" }, children)
      );
    }
    function Tag({ color, children, icon, className, bordered, ...props }) {
      const colorCls = color ? "dfc-tag-" + color : "";
      return React.createElement("span", {
        ...props,
        className: ["dfc-tag", colorCls, className].filter(Boolean).join(" "),
      }, icon && React.createElement("span", { className: "dfc-tag-icon", style: { display: "inline-flex", alignItems: "center", marginRight: children ? 4 : 0 } }, icon), children);
    }
    function Input(props) {
      const { className, type = "text", ...rest } = props;
      return React.createElement("input", {
        type,
        ...rest,
        className: ["dfc-input", className].filter(Boolean).join(" "),
      });
    }
    function TextArea(props) {
      const { autoSize, className, rows, ...rest } = props;
      return React.createElement("textarea", {
        ...rest,
        className: ["dfc-input dfc-textarea", className].filter(Boolean).join(" "),
        rows: autoSize?.minRows || rows || 4,
      });
    }
    Input.TextArea = TextArea;
    function Checkbox({ checked, onChange, children, className, disabled, ...props }) {
      return React.createElement("label", {
        className: ["dfc-checkbox-label", disabled ? "is-disabled" : "", className].filter(Boolean).join(" "),
      },
        React.createElement("input", {
          type: "checkbox",
          checked: Boolean(checked),
          disabled,
          onChange,
          className: "dfc-checkbox",
          ...props,
        }),
        children ? React.createElement("span", { className: "dfc-checkbox-text" }, children) : null
      );
    }
    function hostModalButton(label, onClick, kind, extra) {
      const options = extra || {};
      const isDanger = kind === "danger" || options.danger;
      const variant = isDanger ? "outline" : (kind === "primary" ? "primary" : "outline");
      const dangerClass = isDanger ? "dfc-btn-danger" : "";
      const className = [options.className, dangerClass].filter(Boolean).join(" ") || undefined;
      if (isHostComponent(PrimitiveButton)) {
        return React.createElement(PrimitiveButton, {
          variant,
          disabled: options.disabled,
          className,
          onClick,
          type: "button",
        }, label);
      }
      return React.createElement(Button, {
        variant,
        disabled: options.disabled,
        className,
        onClick,
      }, label);
    }
    function Modal(props) {
      const { open, title, onCancel, onOk, okText, cancelText, okButtonProps, confirmLoading, width = 640, zIndex = 1100, children, footer, className, contentClassName, keyboard, maskClosable, closeLabel, description } = props;
      const requestClose = onCancel || props.onClose;
      const closeRef = useRef(requestClose);
      closeRef.current = requestClose;
      const layerRef = useRef(null);
      if (!layerRef.current) layerRef.current = { owner: props.layerOwner || "modal" };
      useEffect(() => {
        if (!open) return undefined;
        const layer = layerRef.current;
        modalLayers.push(layer);
        const onKey = (event) => {
          if (event.key !== "Escape") return;
          if (modalLayers[modalLayers.length - 1] !== layer) return;
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
          if (keyboard === false) return;
          if (closeRef.current) closeRef.current();
        };
        window.addEventListener("keydown", onKey, true);
        return () => {
          window.removeEventListener("keydown", onKey, true);
          const index = modalLayers.lastIndexOf(layer);
          if (index >= 0) modalLayers.splice(index, 1);
        };
      }, [open, keyboard]);
      if (!open) return null;
      const handleClose = () => { if (closeRef.current) closeRef.current(); };
      const handleOk = () => { if (onOk) onOk(); };
      const actionRow = footer === null ? null : (footer || React.createElement(React.Fragment, null,
        hostModalButton(cancelText || "取消", handleClose, "outline"),
        hostModalButton(okText || "确定", handleOk, okButtonProps?.danger ? "danger" : "primary", { disabled: okButtonProps?.disabled || confirmLoading, danger: okButtonProps?.danger })
      ));
      const footerNode = Array.isArray(actionRow)
        ? React.createElement(React.Fragment, null, actionRow)
        : actionRow;
      const hostDescription = typeof description === "string" && description !== "" ? { description } : {};
      if (typeof HostModal === "function") {
        return h(HostModal, {
          open: true,
          title,
          onClose: handleClose,
          closeLabel: closeLabel || "Close",
          className,
          // 宿主 Modal 把内容区裁在视口内；标记 content 区，让它在超长时滚动。
          contentClassName: ["dfc-modal-content", contentClassName].filter(Boolean).join(" "),
          footer: footerNode,
          ...hostDescription,
        }, children);
      }
      const allowMask = maskClosable !== false && modalLayers[modalLayers.length - 1] === layerRef.current;
      return React.createElement("div", { className: "dfc-modal-root", style: { zIndex } },
        React.createElement("div", { className: "dfc-modal-mask", onClick: allowMask ? handleClose : undefined }),
        React.createElement("div", { className: ["dfc-modal-wrap", className].filter(Boolean).join(" ") },
          React.createElement("div", { className: "dfc-modal-panel", style: { width } },
            React.createElement("div", { className: "dfc-modal-header" },
              React.createElement("div", { className: "dfc-modal-title" }, title),
              React.createElement("button", { type: "button", className: "dfc-modal-close", "aria-label": closeLabel || "Close", onClick: handleClose },
                h(IconCloseFill, { size: 14 })
              )
            ),
            React.createElement("div", { className: "dfc-modal-body" },
              description ? React.createElement("p", { className: "dfc-confirm-content" }, description) : null,
              children),
            footerNode && React.createElement("div", { className: "dfc-modal-footer-wrap" }, footerNode)
          )
        )
      );
    }
    function useModal() {
      const [config, setConfig] = React.useState(null);
      const confirm = (opts) => { setConfig(opts); };
      const holder = config ? React.createElement(Modal, {
        open: true,
        title: config.title,
        width: 480,
        description: config.description,
        onCancel: () => { setConfig(null); },
        onOk: () => {
          const p = config.onOk?.();
          if (p && typeof p.then === "function") {
            p.then(() => setConfig(null));
          } else {
            setConfig(null);
          }
        },
        okText: config.okText,
        cancelText: config.cancelText,
        okButtonProps: config.okButtonProps,
      }, config.content ? React.createElement("p", { className: "dfc-confirm-content" }, config.content) : null) : null;
      return [{ confirm }, holder];
    }
    Modal.useModal = useModal;
    function Switch(props) {
      const on = Boolean(props.checked);
      return React.createElement("button", {
        type: "button",
        role: "switch",
        "aria-checked": on,
        "aria-label": props["aria-label"],
        title: props.title,
        disabled: props.disabled,
        className: "dfc-enable-switch" + (props.className ? " " + props.className : ""),
        onClick: function (event) {
          if (event && typeof event.stopPropagation === "function") event.stopPropagation();
          if (!props.disabled && props.onChange) props.onChange(!on);
        },
      }, React.createElement("span", { className: "dfc-enable-switch-thumb", "aria-hidden": "true" }));
    }
    function Select(props) {
      const [open, setOpen] = useState(false);
      const rootRef = useRef(null);

      useEffect(() => {
        if (!open) return undefined;
        const updateWidth = () => {
          const width = rootRef.current?.getBoundingClientRect().width ?? 0;
          if (width > 0) document.documentElement.style.setProperty("--dfc-menu-width", `${Math.round(width)}px`);
        };
        updateWidth();
        window.addEventListener("resize", updateWidth);
        return () => {
          window.removeEventListener("resize", updateWidth);
          document.documentElement.style.removeProperty("--dfc-menu-width");
        };
      }, [open]);

      useEffect(() => {
        if (!open || typeof window === "undefined") return undefined;
        const layer = { owner: "select" };
        modalLayers.push(layer);
        function onKey(event) {
          if (event.key !== "Escape") return;
          if (modalLayers[modalLayers.length - 1] !== layer) return;
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setOpen(false);
        }
        window.addEventListener("keydown", onKey, true);
        return () => {
          window.removeEventListener("keydown", onKey, true);
          const index = modalLayers.lastIndexOf(layer);
          if (index >= 0) modalLayers.splice(index, 1);
        };
      }, [open]);

      const items = React.useMemo(() => {
        const list = [];
        (props.options || []).forEach((opt, idx) => {
          if (Array.isArray(opt.options)) {
            list.push({ type: "label", id: "group-" + idx, text: opt.label || "" });
            opt.options.forEach((sub) => {
              list.push({ id: String(sub.value), label: sub.label, disabled: sub.disabled, danger: sub.danger });
            });
          } else {
            list.push({ id: String(opt.value), label: opt.label, disabled: opt.disabled, danger: opt.danger });
          }
        });
        return list;
      }, [props.options]);

      const footer = React.useMemo(() => {
        if (!Array.isArray(props.footer) || props.footer.length === 0) return undefined;
        return props.footer.map((item) => ({
          id: String(item.value),
          label: item.label,
          disabled: item.disabled,
          danger: item.danger,
        }));
      }, [props.footer]);

      const selectedOption = React.useMemo(() => {
        for (const opt of props.options || []) {
          if (Array.isArray(opt.options)) {
            const found = opt.options.find((sub) => String(sub.value) === String(props.value));
            if (found) return found;
          } else if (String(opt.value) === String(props.value)) {
            return opt;
          }
        }
        return null;
      }, [props.options, props.value]);

      const currentText = selectedOption ? selectedOption.label : (props.placeholder || props["aria-label"] || "");

      return React.createElement("div", {
        ref: rootRef,
        className: "dfc-menu-select-wrap " + (props.className || ""),
        style: props.style,
      },
        React.createElement(HostMenu, {
          open: open,
          listClassName: ["dfc-form-menu", props.listClassName].filter(Boolean).join(" "),
          onClose: () => setOpen(false),
          onSelect: (id) => {
            if (props.footer && props.footer.some((item) => String(item.value) === id)) {
              if (typeof props.onFooter === "function") props.onFooter(id);
              setOpen(false);
              return;
            }
            if (props.onChange) props.onChange(id);
            setOpen(false);
          },
          selectedId: props.value != null ? String(props.value) : undefined,
          align: "start",
          portal: true,
          dense: true,
          anchor: React.createElement(Button, {
            variant: "outline",
            size: "sm",
            role: "combobox",
            "aria-label": props["aria-label"] || props.placeholder,
            "aria-expanded": open,
            disabled: props.disabled,
            className: "dfc-menu-select-trigger" + (open ? " is-open" : ""),
            onClick: () => { if (!props.disabled) setOpen((prev) => !prev); },
          },
            React.createElement("span", { className: "dfc-menu-select-label" }, currentText),
            h(IconChevronDownOutline, {
              size: 12,
              className: "dfc-menu-select-arrow",
              style: { marginLeft: 4, transition: "transform 150ms ease", transform: open ? "rotate(180deg)" : "none" },
            })
          ),
          items: items,
          ...(footer ? { footer } : {}),
        })
      );
    }
    function createSpinner() {
      return h(IconLoadingOutline, {
        size: 14,
        className: "dfc-btn-spinner",
        style: { marginRight: 6, display: "inline-block", verticalAlign: "-2px", animation: "dfc-spin 0.8s linear infinite" },
      });
    }
    function Button({ variant, type, danger, loading, block, size, shape, className, children, href, target, rel, icon, ...props }) {
      let mappedVariant = variant ?? "outline";
      if (type === "primary") mappedVariant = "primary";
      else if (type === "text" || type === "link") mappedVariant = "ghost";

      const isPrimary = mappedVariant === "primary";
      const mappedSize = (size === "small" || size === "sm") ? "sm" : "md";

      const classes = [
        "dfc-btn",
        href ? "dfc-link-btn" : "",
        className,
        isPrimary ? "is-primary" : "",
        danger ? "is-danger dfc-btn-danger" : "",
        (danger && isPrimary) ? "dfc-btn-danger-primary" : "",
        block ? "is-block" : "",
        loading ? "is-loading" : "",
      ].filter(Boolean).join(" ");

      const iconElement = loading
        ? createSpinner()
        : (icon ? React.createElement("span", {
            key: "icon",
            className: "dfc-btn-icon",
            style: { display: "inline-flex", alignItems: "center" },
          }, icon) : null);
      const content = [iconElement, children];

      if (href) {
        return React.createElement("a", Object.assign({}, props, {
          href,
          target,
          rel: rel || (target === "_blank" ? "noreferrer" : undefined),
          className: classes || undefined,
          "aria-label": props["aria-label"],
          style: props.style,
        }), content);
      }

      if (isHostComponent(PrimitiveButton)) {
        return React.createElement(PrimitiveButton, Object.assign({}, props, {
          variant: mappedVariant,
          size: mappedSize,
          className: [className, danger ? "dfc-btn-danger" : ""].filter(Boolean).join(" ") || undefined,
          disabled: props.disabled || loading,
          icon: loading ? undefined : icon,
        }), loading ? createSpinner() : children);
      }

      return React.createElement("button", Object.assign({}, props, {
        type: "button",
        className: classes || undefined,
        disabled: props.disabled || loading,
      }), content);
    }

    const IconSettingsOutline16 = pickHostIcon("IconSettingsOutlineRegular", "IconSettingsOutline16");
    const CHANNEL_SETTINGS_EVENT = "dsh-feishu-channels:open-channel-settings";
    const CHANNEL_SETTINGS_STORAGE_KEY = "dsh-feishu-channels:pending-channel-settings";
    const SETTINGS_CODEX_TRIGGER_SELECTOR = "[data-dcu-settings-trigger]";
    const SETTINGS_CODEX_PAGE_SELECTOR = "[data-dcu-settings-page]";
    const SETTINGS_OPEN_SECTION_EVENT = "dcu-settings-open-section";
    function parseChannelSettingsRequest(value) {
      if (!value || typeof value !== "object") return undefined;
      const channelId = typeof value.channelId === "string" ? value.channelId.trim() : "";
      if (!channelId) return undefined;
      return { channelId, name: typeof value.name === "string" ? value.name : "" };
    }
    function writeChannelSettingsRequest(storage, request) {
      try { storage && storage.setItem(CHANNEL_SETTINGS_STORAGE_KEY, JSON.stringify(request)); } catch { /* ignore */ }
    }
    function requestChannelSettings(request) {
      if (typeof window === "undefined") return;
      writeChannelSettingsRequest(window.sessionStorage, request);
      window.dispatchEvent(new CustomEvent(CHANNEL_SETTINGS_EVENT, { detail: request }));
    }
    function readChannelSettingsRequest(storage) {
      if (!storage) return undefined;
      try {
        const raw = storage.getItem(CHANNEL_SETTINGS_STORAGE_KEY);
        return raw == null ? undefined : parseChannelSettingsRequest(JSON.parse(raw));
      } catch { return undefined; }
    }
    function clearChannelSettingsRequest(storage) {
      try { storage && storage.removeItem(CHANNEL_SETTINGS_STORAGE_KEY); } catch { /* ignore */ }
    }
    function resolveChannelSettingsTarget(request, channels) {
      const parsed = parseChannelSettingsRequest(request);
      if (!parsed || !Array.isArray(channels)) return undefined;
      const channel = channels.find((item) => item && item.id === parsed.channelId);
      if (!channel) return undefined;
      const accounts = channel.accounts || [];
      return { channelId: channel.id, accountId: accounts.length === 1 ? accounts[0].id : undefined };
    }
    function pickSettingsSectionButton(buttons, labels) {
      const normalize = (value) => String(value || "").replace(/\s+/g, "").trim().toLowerCase();
      const labelOf = (button) => normalize(button.textContent) || normalize(button.getAttribute && button.getAttribute("aria-label"));
      const targets = labels.map(normalize).filter(Boolean);
      for (const target of targets) {
        const match = buttons.find((button) => labelOf(button) === target);
        if (match) return match;
      }
      // 宿主可能在标签旁加计数或徽标；退一步做包含匹配。
      for (const target of targets) {
        const match = buttons.find((button) => {
          const text = labelOf(button);
          return text !== "" && (text.includes(target) || target.includes(text));
        });
        if (match) return match;
      }
      return undefined;
    }
    function pickSettingsLauncher(buttons) {
      const named = buttons.find((button) => {
        const label = `${button.textContent || ""} ${typeof button.getAttribute === "function" ? button.getAttribute("aria-label") || "" : ""}`.trim();
        return /(^|\s)(设置|settings)(\s|$)/i.test(label);
      });
      return named || (buttons.length === 1 ? buttons[0] : undefined);
    }
    function findAccountMenuTrigger() {
      const exact = [
        'button[aria-label="账号菜单"]',
        'button[aria-label="Account menu"]',
      ];
      for (const selector of exact) {
        const found = document.querySelector(selector);
        if (found) return found;
      }
      return [...document.querySelectorAll('button[aria-haspopup="menu"]')].find((button) => {
        const label = `${typeof button.getAttribute === "function" ? button.getAttribute("aria-label") || "" : ""} ${button.textContent || ""}`.trim();
        return /账号|account/i.test(label);
      });
    }
    function requestCodexSettingsSection(labels) {
      const trigger = typeof document !== "undefined" && document.querySelector(SETTINGS_CODEX_TRIGGER_SELECTOR);
      if (!trigger) return false;
      const request = new CustomEvent(SETTINGS_OPEN_SECTION_EVENT, { detail: { labels: [...labels] }, cancelable: true });
      return !trigger.dispatchEvent(request);
    }
    function openImSettingsPage(t) {
      openSettingsSection(
        [t("settings.label"), DFC_LOCALES.en["settings.label"], DFC_LOCALES.zh["settings.label"]],
        () => {},
        () => console.warn("[dsh-feishu-channels] 无法打开 IM 助理设置页"),
      );
    }
    function openSettingsSection(labels, onSelected, onMissing) {
      if (typeof document === "undefined" || typeof window === "undefined") {
        if (onMissing) onMissing();
        return;
      }
      if (requestCodexSettingsSection(labels)) {
        if (onSelected) onSelected();
        return;
      }
      const launchers = [...document.querySelectorAll('button[aria-haspopup="dialog"], button[aria-label*="设置"], button[aria-label*="Settings"], [data-dcu-settings-trigger]')];
      const namedSettingsButton = [...document.querySelectorAll("button")].find((button) => /^(设置|settings)$/i.test((button.getAttribute("aria-label") || "").trim()));
      const launcher = namedSettingsButton || pickSettingsLauncher(launchers);
      const pageTrigger = document.querySelector(SETTINGS_CODEX_TRIGGER_SELECTOR);
      const dialogOpen = document.querySelector('[role="dialog"]') !== null;
      const pageOpen = document.querySelector(SETTINGS_CODEX_PAGE_SELECTOR) !== null;
      let menuTrigger;
      if (!dialogOpen && !pageOpen && !launcher && !pageTrigger) {
        menuTrigger = findAccountMenuTrigger();
        if (!menuTrigger) {
          if (onMissing) onMissing();
          return;
        }
        menuTrigger.click();
      } else if (!dialogOpen && !pageOpen) {
        (pageTrigger || launcher).click();
      }
      let frame;
      let finished = false;
      let menuActivated = false;
      let timeout;
      const observer = new MutationObserver(() => { schedule(); });
      const cleanup = () => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        window.clearTimeout(timeout);
        if (frame !== undefined) window.cancelAnimationFrame(frame);
      };
      const wait = () => {
        timeout = window.setTimeout(() => {
          if (select()) return;
          cleanup();
          if (onMissing) onMissing();
        }, 5000);
      };
      const select = () => {
        if (menuTrigger !== undefined && !menuActivated) {
          const items = [...document.querySelectorAll('[role="menuitem"], [role="menu"] button')];
          const entry = pickSettingsSectionButton(items, ["设置", "Settings"]);
          if (!entry) return false;
          menuActivated = true;
          window.clearTimeout(timeout);
          wait();
          entry.click();
          schedule();
          return true;
        }
        const buttons = [
          ...document.querySelectorAll('[role="dialog"] nav button, [role="dialog"] button'),
          ...document.querySelectorAll(SETTINGS_CODEX_PAGE_SELECTOR + " nav button"),
          ...document.querySelectorAll("nav button, button"),
        ];
        const target = pickSettingsSectionButton(buttons, labels);
        if (!target) return false;
        cleanup();
        target.click();
        if (onSelected) onSelected();
        return true;
      };
      const schedule = () => {
        if (finished || frame !== undefined) return;
        frame = window.requestAnimationFrame(() => { frame = undefined; select(); });
      };
      wait();
      observer.observe(document.body, { childList: true, subtree: true });
      schedule();
    }
    const EMPTY_EXTRA_TABS = [];
    const inject = ["slots", "sessions", "workspaces", "locale"];
    const API_BASE = "/api/dsh-feishu-channels";
    const TAB_KEY = "dsh-feishu-channels.sidebar-tab";
    const ACCOUNT_SELECTION_KEY = "dsh-feishu-channels.settings.selected-account";
    const DFC_LOCALE_NS = "feishu-channel";
    const DFC_LOCALES = {
      zh: {
        "diagnostic.title": "连接诊断", "diagnostic.scope": "以下为本次平台接口或心跳检查结果。未发送测试消息，消息投递权限仍未验证。", "diagnostic.credentials": "应用凭据验证", "diagnostic.bot": "机器人身份查询", "diagnostic.gateway": "网关查询", "diagnostic.passed": "通过", "diagnostic.failed": "失败", "diagnostic.unverified": "未验证",
        "diagnostic.local-state": "无法读取凭据或初始化本地账号状态，请检查本机配置及文件访问权限。", "diagnostic.cancelled": "诊断已取消，未确认连接状态。", "diagnostic.ok": "平台已返回有效响应", "diagnostic.auth": "凭据缺失或失效，请重新配置或扫码绑定。", "diagnostic.permission": "平台拒绝访问，请检查应用权限。", "diagnostic.rate-limit": "平台限流，请稍后再试。", "diagnostic.server": "平台服务异常，请稍后再试。", "diagnostic.network": "网络请求失败，请检查网络或代理。", "diagnostic.timeout": "诊断超时，请检查网络后重试。", "diagnostic.invalid-response": "平台响应不完整或格式不符，无法确认可用。", "diagnostic.rejected": "平台拒绝请求，请核对应用配置和权限。", "diagnostic.missing-context": "缺少原聊天上下文，请用扫码账号先发送一条消息后重试。", "diagnostic.not-connected": "当前没有可验证的连接，请先重新连接。", "diagnostic.unsupported": "当前 SDK 或配置不支持此诊断，未判定为通过。", "diagnostic.changed": "账号状态已变化，请重新诊断。", "connection.restartRequired": "前后端版本不一致。请完整重启 DSH 并刷新页面后重新诊断。", "connection.receiveUnknown": "无法读取接收开关，请重启 DSH 并刷新页面。",
        "connection.checkFailed": "状态检查未完成，请重试；仍失败时查看本机日志。", "connection.diagnostics": "连接诊断", "action.collapse": "收起", "action.expand": "展开", "composer.remoteTitle": "飞书频道会话", "composer.remoteHint": "该会话只能在飞书客户端继续；本地输入已禁用。", "composer.model": "模型", "composer.modelLoading": "模型加载中", "composer.modelUnavailable": "模型不可用", "composer.modelReadOnly": "在账号设置中切换模型",
        "connection.connected": "已连接", "connection.connecting": "连接中", "connection.reconnecting": "重连中", "connection.disconnected": "未连接", "connection.stopped": "已停止", "connection.error": "连接异常", "connection.unknown": "状态未知", "connection.paused": "接收已暂停",
        "connection.title": "本次状态检查", "connection.scope": "仅检查本机渠道运行状态，未验证平台凭据或消息收发。", "connection.checkedAt": "检查时间", "connection.receiveOn": "接收开关已开启", "connection.receiveOff": "接收开关已关闭；请在账号列表开启后再发送消息。", "connection.checking": "检查中…",
        "connection.next.connected": "可在原聊天发送消息验证收发；私聊仍需符合准入设置。", "connection.next.connecting": "请稍后再次检查；等待扫码时请完成手机确认。", "connection.next.reconnecting": "渠道正在尝试恢复，请稍后再次检查。", "connection.next.disconnected": "请重新连接；需要扫码的渠道可重新添加绑定。", "connection.next.stopped": "请点击重新连接以启动账号。", "connection.next.error": "请尝试重新连接；仍有异常时查看本机日志。", "connection.next.unknown": "暂时无法确认状态，请稍后再检查或查看本机日志。",
        "settings.label": "飞书频道", "settings.title": "飞书频道", "settings.description": "管理飞书机器人账号。每个账号独立选择工作区、模型和权限，配置仅保存在本机。", "settings.aria": "飞书频道", "settings.publicChatNotice": "未批准用户可以发起聊天，但不能批准工具调用。", "pending.notice": "有访问请求。批准后该用户才能驱动本机助手。", "action.approve": "批准", "action.deny": "拒绝", "loading": "加载中…",
        "account.presetUnavailable": "预设不可用", "account.presetNote": "更改后使用新会话，旧会话保留。", "action.settings": "设置", "command.dm": "私聊命令", "command.group": "群聊命令", "command.enabled": "可以执行命令", "command.disabled": "仅正常对话",
        "account.workspace": "工作区", "account.currentWorkspace": "当前工作区", "account.selectWorkspace": "请选择工作区", "account.selectModel": "请选择模型", "account.selectPermission": "请选择权限", "account.privateAccess": "私聊准入", "account.privateApproved": "仅已批准用户", "account.privateAll": "允许所有私聊用户", "account.sendMode": "发送方式", "account.sendQueue": "排队发送", "account.sendSteer": "插话发送", "account.sendSteerNote": "插话发送会把消息作为补充指令立即交给运行中的任务；任务空闲时与排队发送相同。", "account.autoNameNote": "该名称会作为本地频道名称，并预填到飞书应用创建页。", "account.defaultName": "{channel}账号 {count}", "account.channelName": "频道名称", "account.noSessions": "还没有会话，请通过飞书客户端给机器人发一条消息...", "channel.empty": "还没有飞书账号。点击上方“添加飞书账号”开始。", "session.untitled": "未命名会话", "app.info": "飞书App信息", "app.id": "App ID", "app.secret": "App Secret", "app.copy": "复制", "app.copied": "已复制", "app.reveal": "显示", "app.hide": "隐藏", "app.notSaved": "未保存", "provisioning.redirectMissing": "重定向 URL 未能自动写入", "provisioning.scopesMissing": "部分权限未确认", "provisioning.copyUrls": "复制重定向 URL", "provisioning.manageScopeMissing": "缺少应用配置权限 application:application:patch，无法写入重定向 URL。", "provisioning.applyScope": "去添加权限", 
        "account.remark": "名称备注", "account.remarkNote": "只在本机设置页区分账号，留空恢复自动名称。", "account.rename": "修改名称备注",
        "account.count": "{count} 个账号", "account.statusProcessing": "处理中…", "account.statusNotConnected": "未连接", "account.receive": "接收消息", "account.receiveDescription": "关闭后保留账号配置，但不接收新消息", "account.removeConfirm": "确定移除这个账号？本机保存的配置和凭据将一并删除。",
        "action.addAccount": "添加飞书账号", "action.generateQr": "生成二维码", "action.checkConnection": "诊断连接", "action.reconnectAccount": "重新连接", "action.removeAccount": "移除接入", "status.saving": "保存中…", "status.saved": "已保存",
        "channel.feishu": "飞书", "bind.title": "添加飞书账号", "bind.tabsAria": "绑定方式", "bind.quick": "快捷绑定（推荐）", "bind.manual": "手动配置", "bind.saving": "正在保存账号…", "bind.success": "绑定成功，频道已连接", "bind.newIdentity": "检测到新的账号身份，已创建新账号", "bind.qrAlt": "{channel} 绑定二维码", "bind.generating": "正在生成…", "bind.expire": "二维码 {time} 后过期", "bind.scanned": "已扫码，请在手机上确认", "bind.retry": "请重新生成二维码", "bind.refresh": "重新生成二维码", "action.saving": "保存中…", "action.confirm": "确认",
        "qr.feishu": "请使用飞书扫描二维码，将自动创建机器人", "qr.default": "请使用对应 App 扫描二维码",
        "action.more": "{channel} 更多",
        "error.loadAssistant": "无法加载账号配置", "error.noModels": "当前 Host 还没有可用模型，请先在网页里配置提供商", "error.save": "保存失败", "error.chooseWorkspace": "请选择工作区目录", "error.workspaceUnavailable": "当前 Host 无法新增工作区", "error.addWorkspace": "新增工作区失败", "error.load": "加载失败", "error.connection": "无法连接本机 IM 助理接口", "error.request": "请求失败", "error.action": "操作失败", "error.qr": "无法生成二维码", "error.detailsInLog": "操作失败，请查看服务器日志。",
        "composer.noWorkspaces": "暂无工作区", "composer.addWorkspace": "添加工作区…", "composer.workspaceRequired": "请先添加工作区，否则无法保存", "composer.permission": "权限", "composer.noModels": "暂无模型", "action.cancel": "取消",
        "permission.readOnly": "只读", "permission.workspaceWrite": "工作区写入", "permission.fullAccess": "完全访问",
        "rail.workspace": "工作区", "rail.sessions": "会话", "rail.search": "搜索", "rail.searchPlaceholder": "搜索会话...", "rail.clearSearch": "清除搜索", "rail.filter": "筛选", "rail.group": "分组方式", "rail.byWorkspace": "按工作区", "rail.list": "单列表", "rail.byWorkspaceTree": "按工作区树", "rail.byChannel": "按飞书账号", "rail.treeUnavailable": "当前宿主未提供官方任务树。", "rail.groupReadOnly": "飞书分组不能在这里重命名或删除。", "rail.sort": "排序方式", "rail.recent": "最近更新", "rail.showArchived": "显示已归档", "rail.onlyArchived": "仅显示已归档", "rail.running": "运行中", "rail.idle": "空闲", "rail.waitingApproval": "等待审批", "rail.planReview": "计划待审", "rail.waitingAnswer": "等待回答", "rail.subagents": "{n} 个子代理运行中", "rail.completed": "已完成", "rail.archived": "已归档", "rail.compactApproval": "待审批", "rail.compactPlan": "计划待审", "rail.compactAnswer": "待回答", "rail.renameAria": "重命名会话", "rail.rename": "重命名", "rail.fork": "分叉会话", "rail.archive": "归档会话", "rail.unarchive": "恢复会话", "rail.deleteSession": "删除会话", "rail.deleteSessionConfirm": "删除会话", "rail.deleteSessionDescription": "将永久删除会话“{name}”及其子代理（含正在运行的）和全部记录（对话内容、统计、缓存），此操作不可恢复。", "rail.deleteSessionPending": "正在删除会话…", "rail.deleteSessionFailed": "删除会话失败：{message}", "rail.deleteSessionClose": "关闭", "rail.deleteSessionCancel": "取消", "rail.groupActions": "“{name}”的飞书操作", "rail.channelSettings": "飞书频道设置", "rail.addChannel": "添加飞书账号", "rail.empty": "还没有飞书会话。先在设置 → 飞书频道 里连接飞书机器人，并给机器人发一条消息。", "rail.ungrouped": "未分组", "rail.tabsAria": "工作区分类", "rail.tasks": "任务", "rail.channels": "频道", "rail.feishu": "飞书频道",
        "time.now": "刚刚", "time.minutes": "{n}分钟", "time.hours": "{n}小时", "time.days": "{n}天", "time.months": "{n}个月", "time.years": "{n}年", "time.ago": "{t}前",
        "copy": "复制", "hover.copied": "已复制",
        "server.unknownChannel": "未知渠道", "server.channelUnconfigured": "渠道未配置", "server.sessionMissing": "会话不存在", "server.accountMissing": "账号不存在", "server.accountConnectFailed": "账号连接失败，请查看本机日志", "server.accountReconnectFailed": "重新连接失败，请查看本机日志", "server.selectAccountSettings": "请选择提供商、模型、工作区或权限", "server.selectModel": "请选择提供商和模型", "server.selectWorkspace": "请选择工作区", "server.createWorkspace": "请先添加工作区", "server.selectPermission": "请选择权限", "server.missingCredentials": "凭据不足，无法启动渠道", "server.qrUnsupported": "该渠道不支持扫码绑定", "server.qrExpired": "二维码已过期", "server.qrIncomplete": "扫码未完成", "server.accessDenied": "未授权：请管理员在设置 → 飞书频道 中批准你的访问。", "server.remarkTooLong": "账号备注不能超过 40 个字符", "server.remarkControl": "账号备注不能包含换行或控制字符",
        "status.stopped": "已停止", "status.longConnection": "长连接已建立", },
      en: {
        "diagnostic.title": "Connection diagnostics", "diagnostic.scope": "Results from platform queries or a connection heartbeat in this check. No test messages were sent; message delivery permissions remain unverified.", "diagnostic.credentials": "Application credentials", "diagnostic.bot": "Bot identity query", "diagnostic.gateway": "Gateway query", "diagnostic.passed": "Passed", "diagnostic.failed": "Failed", "diagnostic.unverified": "Unverified",
        "diagnostic.local-state": "Could not read credentials or initialize local account state. Check local configuration and file permissions.", "diagnostic.cancelled": "The check was cancelled. Connection status was not verified.", "diagnostic.ok": "The platform returned a valid response", "diagnostic.auth": "Credentials are missing or invalid. Configure or pair the account again.", "diagnostic.permission": "Access was denied. Check application permissions.", "diagnostic.rate-limit": "The platform rate limit was reached. Retry later.", "diagnostic.server": "The platform service failed. Retry later.", "diagnostic.network": "The request failed. Check your network or proxy.", "diagnostic.timeout": "The check timed out. Check your network and retry.", "diagnostic.invalid-response": "The platform response was incomplete or invalid. Availability could not be confirmed.", "diagnostic.rejected": "The platform rejected the request. Check application settings and permissions.", "diagnostic.missing-context": "The original chat context is missing. Send a message from the paired account and retry.", "diagnostic.not-connected": "No active connection is available to verify. Reconnect first.", "diagnostic.unsupported": "The current SDK or configuration does not support this check. It has not passed.", "diagnostic.changed": "The account state changed. Run diagnostics again.", "connection.restartRequired": "The frontend and backend versions do not match. Fully restart DSH, refresh this page, and retry.", "connection.receiveUnknown": "The receiving setting is unavailable. Restart DSH and refresh this page.",
        "connection.checkFailed": "The status check could not be completed. Retry, or check the local logs if it keeps failing.", "connection.diagnostics": "Connection diagnostics", "action.collapse": "Collapse", "action.expand": "Expand", "composer.remoteTitle": "Feishu channel session", "composer.remoteHint": "This session can only continue in Feishu; local input is disabled.", "composer.model": "Model", "composer.modelLoading": "Loading models", "composer.modelUnavailable": "Model unavailable", "composer.modelReadOnly": "Change the model in account settings",
        "connection.connected": "Connected", "connection.connecting": "Connecting", "connection.reconnecting": "Reconnecting", "connection.disconnected": "Disconnected", "connection.stopped": "Stopped", "connection.error": "Connection error", "connection.unknown": "Status unknown", "connection.paused": "Receiving paused",
        "connection.title": "Status check result", "connection.scope": "Checks local channel runtime only. Platform credentials and message delivery have not been verified.", "connection.checkedAt": "Checked at", "connection.receiveOn": "Receiving is enabled", "connection.receiveOff": "Receiving is disabled. Enable it in the account list before sending messages.", "connection.checking": "Checking…",
        "connection.next.connected": "Send a message in the original chat to verify delivery. Private chats still follow access settings.", "connection.next.connecting": "Check again shortly. Complete confirmation on your phone if a QR scan is pending.", "connection.next.reconnecting": "The channel is attempting to recover. Check again shortly.", "connection.next.disconnected": "Reconnect the account. QR channels may need to be added again.", "connection.next.stopped": "Select Reconnect to start the account.", "connection.next.error": "Try reconnecting. If the issue persists, check the local logs.", "connection.next.unknown": "The current state could not be confirmed. Check again later or inspect the local logs.",
        "settings.label": "Feishu Channel", "settings.title": "Feishu Channel", "settings.description": "Manage Feishu bot accounts. Each account has its own workspace, model, and permission settings, stored only on this machine.", "settings.aria": "Feishu Channel", "settings.publicChatNotice": "Unapproved users can start chats, but they cannot approve tool calls.", "pending.notice": "There are access requests. Approve a user before they can control the local assistant.", "action.approve": "Approve", "action.deny": "Deny", "loading": "Loading…",
        "account.presetUnavailable": "Preset unavailable", "account.presetNote": "Changes start a new session; previous sessions are kept.", "action.settings": "Settings", "command.dm": "DM commands", "command.group": "Group commands", "command.enabled": "Commands enabled", "command.disabled": "Conversation only",
        "account.workspace": "Workspace", "account.currentWorkspace": "Current workspace", "account.selectWorkspace": "Select a workspace", "account.selectModel": "Select a model", "account.selectPermission": "Select a permission", "account.privateAccess": "Private chat access", "account.privateApproved": "Approved users only", "account.privateAll": "Allow all DM users", "account.sendMode": "Send mode", "account.sendQueue": "Queue", "account.sendSteer": "Steer", "account.sendSteerNote": "Steer hands the message to the running task as additional instructions at its next step; when the task is idle it behaves like Queue.", "account.autoNameNote": "Used as the local channel name and prefilled on the Feishu app creation page.", "account.defaultName": "{channel} account {count}", "account.channelName": "Channel name", "account.noSessions": "No sessions yet. Send the bot a message from the Feishu client...", "channel.empty": "No Feishu accounts yet. Use “Add Feishu account” above.", "session.untitled": "Untitled session", "app.info": "Feishu app info", "app.id": "App ID", "app.secret": "App Secret", "app.copy": "Copy", "app.copied": "Copied", "app.reveal": "Show", "app.hide": "Hide", "app.notSaved": "Not saved", "provisioning.redirectMissing": "Redirect URLs were not written automatically", "provisioning.scopesMissing": "Some scopes were not confirmed", "provisioning.copyUrls": "Copy redirect URLs", "provisioning.manageScopeMissing": "The app is missing application:application:patch, so redirect URLs cannot be written.", "provisioning.applyScope": "Add permission", 
        "account.remark": "Name remark", "account.remarkNote": "Shown only in settings to tell accounts apart. Leave blank to restore the automatic name.", "account.rename": "Edit name remark",
        "account.count": "{count} accounts", "account.statusProcessing": "Processing…", "account.statusNotConnected": "Not connected", "account.receive": "Receive messages", "account.receiveDescription": "Turn this off to keep the account settings without receiving new messages", "account.removeConfirm": "Remove this account? Its saved settings and credentials will also be deleted.",
        "action.addAccount": "Add Feishu account", "action.generateQr": "Generate QR code", "action.checkConnection": "Diagnose connection", "action.reconnectAccount": "Reconnect", "action.removeAccount": "Remove", "status.saving": "Saving…", "status.saved": "Saved",
        "channel.feishu": "Feishu", "bind.title": "Add Feishu account", "bind.tabsAria": "Setup method", "bind.quick": "Quick setup (recommended)", "bind.manual": "Manual setup", "bind.saving": "Saving account…", "bind.success": "Connected successfully", "bind.newIdentity": "A new account identity was detected and a new account was created", "bind.qrAlt": "{channel} setup QR code", "bind.generating": "Generating…", "bind.expire": "QR code expires in {time}", "bind.scanned": "Scanned. Confirm on your phone.", "bind.retry": "Generate a new QR code", "bind.refresh": "Generate a new QR code", "action.saving": "Saving…", "action.confirm": "Confirm",
        "qr.feishu": "Scan with Feishu; a bot will be created automatically", "qr.default": "Scan the QR code with the corresponding app",
        "action.more": "More options for {channel}",
        "error.loadAssistant": "Could not load account settings", "error.noModels": "No models are available in the Host. Configure a provider in the web app first.", "error.save": "Could not save", "error.chooseWorkspace": "Choose a workspace directory", "error.workspaceUnavailable": "This Host cannot create workspaces", "error.addWorkspace": "Could not add workspace", "error.load": "Could not load", "error.connection": "Could not connect to the local Feishu Channel API", "error.request": "Request failed", "error.action": "Action failed", "error.qr": "Could not generate a QR code", "error.detailsInLog": "The operation failed. Check the server logs for details.",
        "composer.noWorkspaces": "No workspaces", "composer.addWorkspace": "Add workspace…", "composer.workspaceRequired": "Add a workspace before saving.", "composer.permission": "Permission", "composer.noModels": "No models", "action.cancel": "Cancel",
        "permission.readOnly": "Read Only", "permission.workspaceWrite": "Workspace Write", "permission.fullAccess": "Full access",
        "rail.workspace": "Workspaces", "rail.sessions": "Sessions", "rail.search": "Search", "rail.searchPlaceholder": "Search sessions...", "rail.clearSearch": "Clear search", "rail.filter": "Filter", "rail.group": "Group by", "rail.byWorkspace": "By workspace", "rail.list": "Single list", "rail.byWorkspaceTree": "Workspace Tree", "rail.byChannel": "By channel", "rail.treeUnavailable": "The official tree is unavailable in this Host.", "rail.groupReadOnly": "Feishu groups cannot be renamed or deleted here.", "rail.sort": "Sort by", "rail.recent": "Recently updated", "rail.showArchived": "Show archived", "rail.onlyArchived": "Archived only", "rail.running": "Running", "rail.idle": "Idle", "rail.waitingApproval": "Waiting for approval", "rail.planReview": "Plan to review", "rail.waitingAnswer": "Waiting for an answer", "rail.subagents": "{n} subagents running", "rail.completed": "Completed", "rail.archived": "Archived", "rail.compactApproval": "Approval", "rail.compactPlan": "Plan review", "rail.compactAnswer": "Answer", "rail.renameAria": "Rename session", "rail.rename": "Rename", "rail.fork": "Fork session", "rail.archive": "Archive session", "rail.unarchive": "Restore session", "rail.deleteSession": "Delete session", "rail.deleteSessionConfirm": "Delete session", "rail.deleteSessionDescription": "This permanently deletes session “{name}”, its child agents (including any that are still running), and all of its records (conversation, stats, cache). This cannot be undone.", "rail.deleteSessionPending": "Deleting session…", "rail.deleteSessionFailed": "Could not delete the session: {message}", "rail.deleteSessionClose": "Close", "rail.deleteSessionCancel": "Cancel", "rail.groupActions": "Actions for {name}", "rail.channelSettings": "Channel settings", "rail.addChannel": "Add channel", "rail.empty": "No Feishu sessions yet. Connect a Feishu bot in Settings → Feishu Channel, then send it a message.", "rail.ungrouped": "Ungrouped", "rail.tabsAria": "Workspace categories", "rail.tasks": "Tasks", "rail.channels": "Channels", "rail.feishu": "Feishu",
        "time.now": "now", "time.minutes": "{n}min", "time.hours": "{n}h", "time.days": "{n}d", "time.months": "{n}mo", "time.years": "{n}y", "time.ago": "{t} ago",
        "copy": "Copy", "hover.copied": "Copied",
        "server.unknownChannel": "Unknown channel", "server.channelUnconfigured": "Channel is not configured", "server.sessionMissing": "Session does not exist", "server.accountMissing": "Account does not exist", "server.accountConnectFailed": "Could not connect the account. Check the local logs.", "server.accountReconnectFailed": "Could not reconnect the account. Check the local logs.", "server.selectAccountSettings": "Select a provider, model, workspace, or permission setting", "server.selectModel": "Select a provider and model", "server.selectWorkspace": "Select a workspace", "server.createWorkspace": "Add a workspace first.", "server.selectPermission": "Select a permission", "server.missingCredentials": "The channel cannot start because credentials are missing", "server.qrUnsupported": "This channel does not support QR setup", "server.qrExpired": "QR code has expired", "server.qrIncomplete": "QR setup was not completed", "server.accessDenied": "Access denied: ask an administrator to approve you in Settings → Feishu Channel.", "server.remarkTooLong": "Account remark cannot exceed 40 characters", "server.remarkControl": "Account remark cannot contain line breaks or control characters",
        "status.stopped": "Stopped", "status.longConnection": "Long connection established", },
    };
    const fallbackT = (key) => key;
    const h = React.createElement;
    function HostThemeProvider({ children }) {
      return children;
    }

    const CSS = `
.dfc-page,.dfc-account-modal,.dfc-bind-modal,.dfc-inspector{--dfc-text:var(--dsw-alias-label-primary,var(--dsh-text,#e6edf3));--dfc-muted:var(--dsw-alias-label-tertiary,var(--dsh-text-muted,#8b949e));--dfc-line:var(--dsw-alias-border-l2,var(--dsh-border,rgba(255,255,255,.1)));--dfc-card:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));--dfc-card-hover:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));--dfc-ok:var(--dsw-alias-state-success-primary,#3fb950);--dfc-warning:var(--dsw-alias-state-warning-primary,#d29922);--dfc-danger:var(--dsw-alias-state-error-primary,#f85149);--dfc-accent:var(--dsw-alias-brand-primary,#4b7cff)}
.dfc-page{box-sizing:border-box;max-width:none;width:100%;margin:0;padding:0 0 32px;color:var(--dfc-text)}
.dfc-head{display:flex;flex-direction:column;align-items:stretch;gap:12px;margin-bottom:12px}
.dfc-heading h2,.dfc-title{margin:0;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.4px;white-space:nowrap;text-align:left}
.dfc-title-row{display:flex;align-items:center;gap:8px 12px;min-width:0;flex-wrap:wrap}
.dfc-title-links{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dfc-title-links>span[data-mpi-check]{display:inline-flex;align-items:center}
[data-dfc-nav-icon="assistant"]>svg{display:none!important}
.dfc-nav-icon-assistant{display:inline-block;flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:var(--dfc-nav-icon-mask) center/contain no-repeat;mask:var(--dfc-nav-icon-mask) center/contain no-repeat}
.dfc-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:32px;padding:0 12px;border:0.5px solid var(--dsw-alias-border-l3,#555);border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-primary,#eee);font:inherit;font-size:13px;line-height:20px;cursor:pointer;user-select:none;box-sizing:border-box;text-decoration:none;transition:border-color 120ms ease,color 120ms ease,background 120ms ease}
.dfc-btn:not(.is-primary):not(.dfc-btn-danger){color:var(--dsw-alias-label-primary,#eee)!important}
.dfc-btn:hover:not(:disabled):not(.dfc-btn-danger){border-color:var(--dsw-alias-border-l3,#666)!important;color:var(--dsw-alias-label-primary,#fff)!important;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))!important}
.dfc-btn:focus-visible{outline:var(--dsw-focus-ring-width,1px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary,#4b7cff))!important;outline-offset:0!important}
.dfc-btn:disabled,.dfc-btn.is-disabled{opacity:.4!important;cursor:not-allowed!important;pointer-events:none!important}
.dfc-btn.is-primary,.dfc-bind-ready .dfc-btn.is-primary{background:var(--dsw-alias-button-primary-fill,#f9fafb)!important;border-color:transparent!important;color:var(--dsw-alias-label-primary-foreground,#0f1115)!important}
.dfc-btn.is-primary *,.dfc-bind-ready .dfc-btn.is-primary *{color:inherit!important;fill:currentColor!important}
.dfc-btn.is-primary:hover:not(:disabled),.dfc-bind-ready .dfc-btn.is-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#ebeef2)!important;color:var(--dsw-alias-label-primary-foreground,#0f1115)!important}
.dfc-btn.is-primary:disabled,.dfc-bind-ready .dfc-btn.is-primary:disabled{opacity:.4!important;cursor:not-allowed!important}
.dfc-btn.is-block{width:100%!important}
.dfc-link-btn{height:28px!important;padding:0 10px!important;font-size:12px!important}
.dfc-sub{margin:12px 0 0;max-width:none;color:var(--dfc-muted);font-size:14px;line-height:22px;text-align:left}
.dfc-error{color:var(--dfc-danger);font-size:12px;margin:0 0 12px}
.dfc-pending,.dfc-page>.dfc-feedback,.dfc-inspector .dfc-feedback{margin:0 0 12px}
.dfc-feedback{display:flex;align-items:flex-start;gap:8px;padding:10px 14px;border-radius:var(--dsw-radius-sm,8px);font-size:13px;line-height:20px;border:0.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.08));color:var(--dsw-alias-label-primary,#eee)}
.dfc-feedback-error{background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#f85149) 12%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary,#f85149) 30%, transparent);color:var(--dsw-alias-label-primary,#eee)}
.dfc-feedback-error .dfc-feedback-icon{color:var(--dsw-alias-state-error-primary,#f85149)}
.dfc-feedback-warning{background:color-mix(in srgb, var(--dsw-alias-state-warning-primary,#d29922) 12%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-warning-primary,#d29922) 30%, transparent);color:var(--dsw-alias-label-primary,#eee)}
.dfc-feedback-warning .dfc-feedback-icon{color:var(--dsw-alias-state-warning-primary,#d29922)}
.dfc-feedback-success{background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#3fb950) 12%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary,#3fb950) 30%, transparent);color:var(--dsw-alias-label-primary,#eee)}
.dfc-feedback-success .dfc-feedback-icon{color:var(--dsw-alias-state-success-primary,#3fb950)}
.dfc-feedback-info{background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.08));color:var(--dsw-alias-label-primary,#eee)}
.dfc-feedback-icon{display:inline-flex;align-items:center;flex:none;margin-top:3px}
.dfc-feedback-body{flex:1;min-width:0;word-break:break-word}
.dfc-pending{display:flex;flex-direction:column;gap:8px}
.dfc-feedback-head{display:flex;align-items:center;gap:8px}
.dfc-feedback-title{font-weight:550;line-height:20px}
.dfc-pending-list{display:flex;flex-direction:column;gap:6px;width:100%}
.dfc-pending-row{display:flex;gap:8px;align-items:center;padding:4px 0}
.dfc-wrap{display:flex;flex-direction:column;min-height:0;flex:1;height:100%;overflow:hidden}.dfc-official-tree{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.dfc-tabs-wrap{display:flex;margin:2px var(--dsh-sidebar-inline-padding,12px) 8px 0;padding:0;width:auto}
.dfc-tabs-wrap .dfc-segmented-tabs{display:grid!important;width:100%!important;box-sizing:border-box!important;height:32px!important;min-height:32px!important;max-height:32px!important;padding:2px!important;border:0!important;border-radius:var(--dsw-radius-sm,8px)!important;box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l2,rgba(255,255,255,.08))!important;background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.02))!important}
.dfc-tabs-wrap .dfc-segmented-tabs>span{inset:2px auto 2px 2px!important;width:calc((100% - 4px)/var(--dfc-tab-count,2))!important;border-radius:6px!important;border:0.5px solid var(--dsw-alias-border-l3,rgba(255,255,255,.12))!important;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08))!important;box-shadow:none!important}
.dfc-tabs-wrap .dfc-segmented-tabs [role=tab]{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;height:28px!important;padding:0 clamp(6px,calc(100% - 60px),12px)!important;font-size:13px!important;line-height:20px!important;border-radius:6px!important;color:var(--dsw-alias-label-secondary,#8b8f98)!important;text-align:center!important;white-space:nowrap!important;box-sizing:border-box!important;transition:color 150ms ease!important}
.dfc-tabs-wrap .dfc-segmented-tabs [role=tab]>*{display:inline-flex!important;align-items:center!important;justify-content:center!important}
.dfc-tabs-wrap .dfc-segmented-tabs [role=tab]:hover{color:var(--dsw-alias-label-primary,inherit)!important}
.dfc-tabs-wrap .dfc-segmented-tabs [role=tab][aria-selected=true]{color:var(--dsw-alias-label-primary,inherit)!important;font-weight:600!important}
.dfc-bind-tabs-wrap{width:100%;margin:0 0 16px}
.dfc-bind-tabs-wrap.is-disabled{opacity:.6;pointer-events:none}
.dfc-bind-panel[hidden]{display:none!important}
.dfc-bind-tabs-wrap .dfc-bind-tabs{width:100%;height:32px;box-sizing:border-box;border-bottom:0;background:color-mix(in srgb,var(--dsw-alias-label-primary,currentColor) 3%,transparent)!important;border-radius:var(--dsw-radius-sm,8px)!important;border:0.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.05))!important;padding:2px!important}
.dfc-bind-tabs-wrap .dfc-bind-tabs>span{inset:2px auto 2px 2px!important;width:calc((100% - 4px)/2)!important;border-radius:calc(var(--dsw-radius-sm,8px) - 2px)!important;border:0.5px solid color-mix(in srgb,var(--dsw-alias-label-primary,currentColor) 12%,transparent)!important;background:color-mix(in srgb,var(--dsw-alias-label-primary,currentColor) 8%,transparent)!important;box-shadow:none!important}
.dfc-bind-tabs-wrap .dfc-bind-tabs [role=tab]{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;width:100%!important;height:26px!important;padding:0 10px!important;font-size:13px!important;line-height:18px!important;border-radius:calc(var(--dsw-radius-sm,8px) - 2px)!important;color:var(--dsw-alias-label-secondary,#8b8f98);text-align:center!important}
.dfc-bind-tabs-wrap .dfc-bind-tabs [role=tab]>*{display:inline-flex!important;align-items:center!important;justify-content:center!important}
.dfc-bind-tabs-wrap .dfc-bind-tabs [role=tab]:hover{color:var(--dsw-alias-label-primary,inherit)}
.dfc-bind-tabs-wrap .dfc-bind-tabs [role=tab][aria-selected=true]{color:var(--dsw-alias-label-primary,inherit)!important;font-weight:600}
.dfc-tabs{display:flex;gap:18px;padding:4px 12px 0;border-bottom:1px solid var(--dfc-line)}
.dfc-tab{appearance:none;border:0;background:transparent;color:var(--dfc-muted);padding:8px 0;font-size:13px;cursor:pointer}
.dfc-tab.on{color:var(--dfc-text);box-shadow:inset 0 -2px 0 currentColor}
.dfc-tabs{flex:none}
.dfc-empty{color:var(--dfc-muted);font-size:12px;padding:12px 8px}
.dfc-channel-official{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:hidden}
.dfc-channel-official>div{flex:1;min-width:0;min-height:0}
.dfc-channel-official>.dfc-channel-error{flex:none}
.dfc-channel-official>.dfc-channel-unavailable{flex:1}
.dfc-channel-error{padding:8px 12px;color:var(--dsw-alias-state-error-primary,#f85149);font-size:12px;line-height:18px}
.dfc-channel-unavailable{padding:16px 12px;color:var(--dsw-alias-label-tertiary,#8b8f98);font-size:13px;line-height:20px}
.dfc-session-channel-icon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none}
/* 频道页签复用官方工作区浏览器：分组头操作按模式裁剪。 */
.dfc-channel-official[data-mode="channel"] [data-row-key^="workspace:dsh-im-channel:"]>span:last-child>:last-child{display:none!important}
.dfc-channel-official[data-mode="workspace"] [data-row-key^="workspace:"]>span:last-child,
.dfc-channel-official[data-mode="workspace-tree"] [data-row-key^="workspace:"]>span:last-child{display:none!important}
.dfc-logo{width:28px;height:28px;flex:none;display:block;line-height:0;background:transparent}
.dfc-logo svg{width:28px;height:28px;display:block}
.dfc-logo.sm{width:16px;height:16px;overflow:hidden;display:grid;place-items:center}
.dfc-logo.sm svg{width:16px;height:16px;transform:none}
.dfc-qrbox{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0 4px}
.dfc-qrbox img{width:200px;height:200px;background:#fff;border:1px solid var(--dfc-line);border-radius:12px;object-fit:contain}
.dfc-bind-ready{display:flex;flex-direction:column;align-items:center;gap:14px;padding:12px 0 4px}.dfc-bind-ready .dfc-btn{min-width:136px}.dfc-bind-status{min-height:40px;display:grid;place-items:center;color:var(--dfc-muted);font-size:13px;text-align:center}
.dfc-hint{margin:0;color:var(--dfc-muted);font-size:13px;text-align:center;line-height:1.6}
.dfc-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:13px}
.dfc-field .dfc-input,.dfc-field input{width:100%}
.dfc-input,.dfc-account-remark-input,.dfc-field input{box-sizing:border-box!important;height:36px!important;padding:0 12px!important;border:0.5px solid var(--dsw-alias-border-l2,#494949)!important;border-radius:var(--dsw-radius-sm,8px)!important;background:var(--dsw-alias-bg-layer-1,transparent)!important;color:var(--dsw-alias-label-primary,#eee)!important;font:inherit!important;font-size:13px!important;line-height:20px!important;transition:border-color 120ms ease,background 120ms ease!important}
.dfc-textarea{height:auto!important;min-height:80px;padding:8px 12px!important;resize:vertical}
.dfc-input:hover:not(:disabled),.dfc-account-remark-input:hover:not(:disabled),.dfc-field input:hover:not(:disabled){border-color:var(--dsw-alias-border-l3,#666)!important}
.dfc-input:focus,.dfc-account-remark-input:focus,.dfc-field input:focus{border-color:var(--dsw-alias-brand-primary,#4b7cff)!important;outline:var(--dsw-focus-ring-width,1px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary,#4b7cff))!important;outline-offset:0!important}
.dfc-input::placeholder,.dfc-account-remark-input::placeholder,.dfc-field input::placeholder{color:var(--dsw-alias-label-tertiary,#888)!important}
.dfc-input:disabled,.dfc-account-remark-input:disabled{opacity:.5!important;cursor:not-allowed!important}
.dfc-checkbox-label{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary,#eee);cursor:pointer;user-select:none}
.dfc-checkbox-label.is-disabled{opacity:.5;cursor:not-allowed}
.dfc-checkbox{width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-state-business-primary,#4176e6);cursor:inherit}
.dfc-tag{display:inline-flex!important;align-items:center!important;gap:4px!important;height:22px!important;padding:0 8px!important;font-size:12px!important;line-height:20px!important;border-radius:var(--dsw-radius-sm,6px)!important;font-weight:500!important;box-sizing:border-box!important;vertical-align:middle!important;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:var(--dsw-alias-label-secondary,#b9b9b9);border:none}
.dfc-tag .dfc-btn-spinner{width:11px!important;height:11px!important;margin-right:2px!important;vertical-align:0!important}
.dfc-tag-info,.dfc-tag-processing,.dfc-tag.is-busy{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 14%,transparent)!important;color:var(--dsw-alias-state-business-primary,#4176e6)!important}
.dfc-tag-success{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 14%,transparent)!important;color:var(--dsw-alias-state-success-primary,#3fb950)!important}
.dfc-tag-warning{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d29922) 14%,transparent)!important;color:var(--dsw-alias-state-warn-primary,#d29922)!important}
.dfc-tag-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 14%,transparent)!important;color:var(--dsw-alias-state-error-primary,#f85149)!important}
.dfc-modal-root{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:1100}
.dfc-modal-mask{position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.dfc-modal-wrap{position:relative;max-width:calc(100vw - 32px);max-height:calc(100vh - 48px);overflow:auto;display:flex}
.dfc-modal-panel{position:relative;isolation:isolate;box-sizing:border-box;padding:24px 28px 28px;border-radius:var(--dsw-radius-panel,28px);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px));-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px));border:0.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.1));box-shadow:var(--dsw-elevation-panel,0 20px 48px -12px rgba(0,0,0,.35));color:var(--dsw-alias-label-primary,#eee);display:flex;flex-direction:column;gap:16px}
.dfc-modal-header{display:flex;align-items:center;justify-content:space-between;min-height:24px}
.dfc-modal-title{font-size:17px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary,#eee)}
.dfc-modal-close{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-tertiary,#888);cursor:pointer;transition:all 120ms ease}
.dfc-modal-close:hover{color:var(--dsw-alias-label-primary,#fff);background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}
.dfc-modal-body{min-height:0;overflow:visible;display:flex;flex-direction:column;gap:12px}
.dfc-modal-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}
.dfc-modal-footer-wrap{display:flex;justify-content:flex-end;margin-top:12px;padding-top:16px}
.dfc-inspector-actions>button{flex:none;white-space:nowrap}
.dfc-confirm-content{margin:8px 0 0;font-size:13px;line-height:22px;color:var(--dsw-alias-label-secondary,#b9b9b9)}
.dfc-page.dfc-account-page{container-type:inline-size;min-width:0;width:100%;padding:0 0 32px}
.dfc-account-shell,.dfc-account-shell *{box-sizing:border-box}
.dfc-account-shell{display:block;min-height:0;border:0;border-radius:0;overflow:visible;background:transparent}
.dfc-platforms{display:flex;flex-direction:column;gap:12px;padding:0;border:0;background:transparent;min-width:0}
.dfc-platform{border:1px solid color-mix(in srgb,var(--dfc-text) 16%,transparent);border-radius:12px;margin:0;overflow:hidden;background:var(--dsw-alias-bg-layer-1,color-mix(in srgb,var(--dfc-text) 4%,transparent))}.dfc-platform.open{border-color:color-mix(in srgb,var(--dfc-text) 24%,transparent)}
.dfc-platform-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;min-height:56px;padding:10px 16px;border:0;border-radius:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
.dfc-platform:not(.open):not(.empty) .dfc-platform-head:hover{background:var(--dfc-card-hover)}.dfc-platform.empty .dfc-platform-head{cursor:default}
.dfc-platform-head>.dfc-logo,.dfc-platform-head>.dfc-logo svg{width:24px;height:24px}
.dfc-platform-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600}
.dfc-platform-meta{display:inline-flex;align-items:center;gap:10px}
.dfc-platform-count{color:var(--dfc-muted);font-size:12px;white-space:nowrap}
.dfc-platform-caret{display:grid;width:18px;height:18px;place-items:center;color:var(--dfc-muted);transition:transform .15s ease}.dfc-platform-caret.empty{visibility:hidden}.dfc-platform.open .dfc-platform-caret{transform:rotate(90deg)}
.dfc-account-list{display:flex;flex-direction:column;gap:8px;padding:0 14px 14px}
.dfc-account-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:12px;width:100%;min-height:48px;padding:10px 12px;border:0;border-radius:8px;background:color-mix(in srgb,var(--dfc-text) 7%,transparent);color:inherit;text-align:left}
.dfc-account-row:hover{background:var(--dfc-card-hover)}
.dfc-platform-head:focus-visible,.dfc-account-row:focus-visible{outline:2px solid var(--dfc-accent);outline-offset:2px}
.dfc-account-copy{min-width:0}.dfc-account-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500}.dfc-account-rename-button{width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:text}.dfc-account-rename-button:hover,.dfc-account-rename-button:focus-visible{color:var(--dfc-accent)}.dfc-account-rename,.dfc-account-remark-input{box-sizing:border-box;width:100%;height:32px;padding:4px 8px;border:1px solid var(--dfc-line);border-radius:6px;background:transparent;color:inherit;font:inherit}.dfc-account-id{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dfc-muted);font-size:11px}
.dfc-account-row .dfc-tag{margin-inline-end:0}
.dfc-account-receive{display:inline-flex;align-items:center;justify-content:flex-end;gap:8px;white-space:nowrap;font-size:12px;color:var(--dfc-muted)}
.dfc-inspector{padding:22px 24px 26px;min-width:0}.dfc-inspector-head{display:flex;align-items:flex-start;gap:12px;padding-bottom:18px;border-bottom:1px solid var(--dfc-line)}.dfc-inspector-head-copy{min-width:0;flex:1}.dfc-inspector-title{margin:1px 0 3px;font-size:17px;line-height:24px}.dfc-inspector-title-row{display:flex;align-items:center;gap:12px;min-width:0}.dfc-inspector-title-row .dfc-inspector-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0}.dfc-inspector-title-row .dfc-inspector-status{flex:none;white-space:nowrap;font-size:11px}.dfc-inspector-head-copy>.dfc-account-id{margin-top:5px}
.dfc-inspector-status{flex:none}
.dfc-form{display:flex;flex-direction:column;gap:16px;padding-top:20px}
.dfc-command-permissions{min-width:0;margin:0;padding:0;border:0}
.dfc-diagnostic-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dfc-inspector-title-row .dfc-tag{margin-inline-end:0}.dfc-bind-modal .dfc-feedback{margin-bottom:12px}.dfc-connection-check{display:grid;gap:6px;padding:12px;border:1px solid var(--dfc-line);border-radius:8px;font-size:12px;line-height:1.6;overflow-wrap:anywhere;color:var(--dfc-muted)}.dfc-connection-check strong{color:var(--dfc-text)}.dfc-diagnostic-item{padding:8px 0;border-top:1px solid var(--dfc-line)}
.dfc-inspector-actions{display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;margin-top:16px!important;padding-top:16px!important;padding-bottom:4px!important}
.dfc-account-modal .dfc-inspector{padding:0 0 16px 0}
.dfc-bind-modal,.dfc-account-modal{width:min(720px,100%) !important;max-height:100%;min-height:0}
/* 宿主 Modal 只把 dialog 限制在视口内，内容区默认不滚动，长内容会被裁掉；
   把宿主的 content 区设为滚动容器，footer 保持在容器外可见。 */
.dfc-bind-modal>.dfc-modal-content,.dfc-account-modal>.dfc-modal-content{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.dfc-account-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px;width:100%;box-sizing:border-box}
.dfc-account-settings.compact{grid-template-columns:1fr}
.dfc-picker-field{display:flex;min-width:0;width:100%;flex-direction:column;gap:6px;box-sizing:border-box}
.dfc-picker-field.wide,.dfc-picker-note,.dfc-model-effort{grid-column:1/-1}
.dfc-model-effort{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;min-width:0;width:100%;box-sizing:border-box}
.dfc-account-settings.compact .dfc-model-effort{grid-template-columns:1fr}
.dfc-picker-label{color:var(--dsw-alias-label-secondary,var(--dfc-muted));font-size:12px;font-weight:550;line-height:16px}
.dfc-picker-note{color:var(--dsw-alias-label-tertiary,var(--dfc-muted));font-size:11px;line-height:1.6;margin-top:2px}
.dfc-picker-note.warning{color:var(--dfc-warning)}
.dfc-save-note{color:var(--dfc-muted);font-size:11px}.dfc-save-note.ok{color:var(--dfc-ok)}
.dfc-bind-modal .dfc-setup-section{padding:16px!important;margin:0 0 16px!important;border-radius:var(--dsw-radius-md,12px)!important;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.04))!important;border:0.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))!important}
.dfc-bind-ready{display:flex!important;flex-direction:column!important;align-items:center!important;gap:14px!important;padding:20px 16px!important;border-radius:var(--dsw-radius-md,12px)!important;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.04))!important;border:0.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))!important}
.dfc-bind-ready .dfc-btn{min-width:140px!important;height:36px!important}
.dfc-account-picker{width:100%}
.dfc-enable-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l3,#555);cursor:pointer}
.dfc-enable-switch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}
.dfc-enable-switch:disabled{cursor:default;opacity:.5}
.dfc-enable-switch:focus-visible{outline:var(--dsw-focus-ring-width,1px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.dfc-enable-switch-thumb{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground,#fff);transition:transform 120ms ease;pointer-events:none}
.dfc-enable-switch[aria-checked=false] .dfc-enable-switch-thumb{background:var(--dsw-alias-switch-thumb,#fff)}
.dfc-enable-switch[aria-checked=true] .dfc-enable-switch-thumb{transform:translateX(16px)}
.dfc-form-menu{box-sizing:border-box;width:max(var(--dfc-menu-width,144px),144px)!important;min-width:max(var(--dfc-menu-width,144px),144px)!important;max-width:100%!important}
.dfc-menu-select-wrap,.dfc-menu-select-wrap > *,.dfc-menu-select-wrap span[class*="_root_"],.dfc-menu-select-wrap .dfc-menu-select-trigger,.dfc-account-picker{display:flex!important;width:100%!important;min-width:0!important;box-sizing:border-box!important}
.dfc-menu-select-trigger{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:6px!important;width:100%!important;height:36px!important;padding:0 12px!important;border:0.5px solid var(--dsw-alias-border-l2,#494949)!important;border-radius:var(--dsw-radius-sm,8px)!important;background:var(--dsw-alias-bg-layer-1,transparent)!important;color:var(--dsw-alias-label-primary,#eee)!important;font:inherit!important;font-size:13px!important;cursor:pointer!important;user-select:none!important;box-sizing:border-box!important;transition:border-color 120ms ease,background 120ms ease!important}
.dfc-menu-select-trigger:hover:not(:disabled){border-color:var(--dsw-alias-border-l3,#666)!important;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))!important}
.dfc-menu-select-trigger.is-open{border-color:var(--dsw-alias-brand-primary,#4b7cff)!important;outline:var(--dsw-focus-ring-width,1px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary,#4b7cff))!important}
.dfc-menu-select-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left}
.dfc-menu-select-arrow{flex:none;opacity:0.6}
.dfc-btn-spinner{display:inline-block;vertical-align:-2px;animation:dfc-spin 0.8s linear infinite}
@keyframes dfc-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.dfc-btn-danger{color:var(--dsw-alias-state-error-primary,var(--dfc-danger))!important;border-color:var(--dsw-alias-state-error-primary,var(--dfc-danger))!important}
.dfc-btn-danger:hover:not(:disabled){color:var(--dsw-alias-state-error-primary,var(--dfc-danger))!important;border-color:var(--dsw-alias-state-error-primary,var(--dfc-danger))!important;background:rgba(239,68,68,.12)!important}
.dfc-btn-danger-primary,.dfc-btn-danger.dfc-btn-danger-primary{background:var(--dsw-alias-state-error-primary,var(--dfc-danger))!important;border-color:var(--dsw-alias-state-error-primary,var(--dfc-danger))!important;color:#fff!important}
@container (max-width:480px){.dfc-account-row{grid-template-columns:minmax(0,1fr) auto auto;gap:8px;padding:10px}.dfc-account-receive>span{display:none}.dfc-platform-head{padding:10px 12px}.dfc-account-list{padding:0 12px 12px}}

.dfc-channel-page{display:flex;flex-direction:column;gap:10px;min-height:0;height:100%;box-sizing:border-box;padding:10px 10px 16px;overflow:auto}
.dfc-channel-head{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-height:26px;padding:0 2px 4px;flex:none}
.dfc-channel-add{height:26px!important;min-height:26px!important;padding:0 6px!important;border:0!important;background:transparent!important;color:var(--dsw-alias-label-secondary,#b9b9b9)!important;font-size:11px!important;font-weight:500!important;box-shadow:none!important}
.dfc-channel-add:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))!important;color:var(--dsw-alias-label-primary,#eee)!important}
.dfc-channel-empty{display:flex;align-items:center;justify-content:center;min-height:120px;padding:18px;border:0.5px dashed var(--dsw-alias-border-l2,#494949);border-radius:var(--dsw-radius-md,12px);color:var(--dsw-alias-label-tertiary,#888);font-size:12px;line-height:1.6;text-align:center}
.dfc-channel-pending{padding:10px;border:0.5px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d29922) 35%,transparent);border-radius:var(--dsw-radius-md,12px);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d29922) 8%,transparent)}
.dfc-channel-pending-title{font-size:12px;font-weight:600;color:var(--dsw-alias-state-warn-primary,#d29922);margin-bottom:6px}
.dfc-channel-pending-row{display:flex;align-items:center;gap:6px;padding:4px 0;font-size:11px}
.dfc-channel-pending-user{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#b9b9b9)}
.dfc-channel-accounts{display:flex;flex-direction:column;gap:8px;min-height:0}
.dfc-channel-account{border:0.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08));border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-layer-1,transparent);padding:7px 8px;display:flex;flex-direction:column;gap:5px;min-width:0}
.dfc-channel-account-head{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:nowrap}
.dfc-channel-account-copy{flex:1;min-width:90px;display:flex;flex-direction:column;gap:1px}
.dfc-channel-account-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#eee);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfc-channel-account-actions{display:flex;align-items:center;gap:4px;flex:none;margin-left:auto}
.dfc-channel-account-head .dfc-tag{height:18px!important;min-height:18px!important;font-size:10px!important;line-height:16px!important;padding:0 6px!important}
.dfc-channel-settings{width:24px!important;height:24px!important;min-height:24px!important;padding:0!important;border:0!important;background:transparent!important;color:var(--dsw-alias-label-tertiary,#888)!important;box-shadow:none!important}
.dfc-channel-settings:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))!important;color:var(--dsw-alias-label-primary,#eee)!important}
.dfc-channel-sessions{display:flex;flex-direction:column;gap:1px;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.07));padding-top:5px}
.dfc-channel-session{display:flex;align-items:center;gap:8px;width:100%;min-width:0;border:0;background:transparent;color:inherit;text-align:left;padding:6px 7px;border-radius:var(--dsw-radius-sm,8px);cursor:pointer;font:inherit;transition:background 120ms ease}
.dfc-channel-session:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dfc-channel-session.is-current{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4b7cff) 14%,transparent);box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary,#4b7cff)}
.dfc-channel-session.is-current .dfc-channel-session-title{color:var(--dsw-alias-label-primary,#eee);font-weight:600}
.dfc-channel-session-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-primary,#eee)}
.dfc-channel-session-time{flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary,#888);white-space:nowrap}
.dfc-channel-account-empty{font-size:11px;color:var(--dsw-alias-label-tertiary,#888);line-height:1.5;padding:2px 1px}
.dfc-channel-name-field{margin-bottom:14px}
.dfc-channel-name-field .dfc-picker-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#eee)}
.dfc-app-info{display:flex;flex-direction:column;gap:7px;padding:0;border:0;border-radius:0;background:transparent;margin-bottom:10px}
.dfc-app-info-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#eee)}
.dfc-app-fields{display:grid;grid-template-columns:minmax(0,0.66fr) minmax(0,1.34fr);gap:14px;min-width:0}
.dfc-app-fields .dfc-picker-field{margin:0;min-width:0}
.dfc-app-fields .dfc-copy-row{min-width:0}
.dfc-app-fields .dfc-copy-row .dfc-btn{height:26px!important;padding:0 6px!important;font-size:10px!important;white-space:nowrap}
.dfc-app-info .dfc-picker-field{margin:0}.dfc-app-info .dfc-picker-label{font-size:10px;color:var(--dsw-alias-label-tertiary,#888)}
.dfc-copy-row{display:flex;align-items:center;gap:6px;min-width:0}
.dfc-copy-row .dfc-input{flex:1;min-width:0}
.dfc-copy-row .dfc-btn{flex:none;white-space:nowrap}
.dfc-app-warning{display:flex;align-items:center;gap:8px;justify-content:space-between;font-size:11px;line-height:1.5;color:var(--dsw-alias-state-warn-primary,#d29922)}
.dfc-app-warning .dfc-btn{flex:none;height:24px;padding:0 7px;font-size:10px}.dfc-app-warning a{color:var(--dsw-alias-brand-primary,#4b7cff);text-decoration:none;font-weight:600}.dfc-app-warning a:hover{text-decoration:underline}

.dfc-tab-inline{display:inline-flex;align-items:center;gap:5px;min-width:0}
.dfc-tab-brand{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;color:currentColor}
.dfc-tab-brand svg{width:14px;height:14px;display:block}
.dfc-check-section{display:flex;flex-direction:column;gap:8px;padding:10px 0 2px;border-top:0.5px solid var(--dsw-alias-border-l1,rgba(255,255,255,.08))}
.dfc-check-head{display:flex;align-items:center;gap:8px}
.dfc-check-title{flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#b9b9b9)}
.dfc-check-toggle{height:24px!important;padding:0 7px!important;font-size:11px!important;color:var(--dsw-alias-label-tertiary,#888)!important}
.dfc-remote-composer{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width,952px);margin:0 auto;padding:0 var(--dsh-composer-side-clearance,16px) 18px;display:flex;justify-content:center}
.dfc-remote-composer-card{box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:var(--dsw-radius-panel,20px);border:0.5px solid var(--dsw-alias-border-l2,#494949);background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-1,#1b1b1b));box-shadow:var(--dsw-elevation-soft,0 4px 16px rgba(0,0,0,.12))}
.dfc-remote-composer-icon{width:28px;height:28px;flex:none;display:grid;place-items:center;border-radius:calc(var(--dsw-radius-sm,8px));background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-secondary,#b9b9b9)}
.dfc-remote-composer-icon svg{width:18px;height:18px;display:block}
.dfc-remote-composer-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dfc-remote-composer-title{font-size:13px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary,#eee)}
.dfc-remote-composer-hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#888)}
.dfc-remote-model{display:flex;align-items:center;gap:6px;flex:none;min-width:0}
.dfc-remote-model-label{font-size:12px;line-height:16px;color:var(--dsw-alias-label-tertiary,#888);white-space:nowrap}
.dfc-remote-model-value{box-sizing:border-box;max-width:260px;padding:5px 9px;border:0.5px solid var(--dsw-alias-border-l2,#494949);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,#eee);font-size:13px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dfc-remote-model-missing{font-size:11px}
.dfc-remote-model-missing{flex:none;font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary,#888);white-space:nowrap}
@media (max-width:520px){.dfc-app-fields{grid-template-columns:minmax(0,1fr)}.dfc-remote-composer-card{flex-wrap:wrap}.dfc-remote-model{margin-left:auto}.dfc-remote-model-value{max-width:180px}}

`;

    const TITLE_LINK_CSS = "@media(max-width:720px){.dfc-title-row{flex-wrap:wrap}}";

    let styleEl = null;
    const ensureStyle = () => {
      if (styleEl && styleEl.isConnected) {
        styleEl.setAttribute("data-plugin", "@cubeai/dsh-feishu-channels");
        return;
      }
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-plugin", "@cubeai/dsh-feishu-channels");
      styleEl.textContent = CSS + TITLE_LINK_CSS;
      document.head.appendChild(styleEl);
    };

    let requestHostSessionRefresh = () => {};
    let channelSessionIds = new Set();
    let channelSessionChannels = new Map();
    let channelMembershipRevision = 0;
    const channelMembershipListeners = new Set();
    function updateChannelMembership(groups) {
      const next = new Set();
      const channels = new Map();
      for (const group of groups) {
        for (const session of group.sessions || []) {
          next.add(session.sessionId);
          channels.set(String(session.sessionId), group.id);
        }
      }
      let changed = next.size !== channelSessionIds.size || [...next].some(id => !channelSessionIds.has(id));
      if (!changed) {
        for (const [id, channel] of channels) {
          if (channelSessionChannels.get(id) !== channel) { changed = true; break; }
        }
      }
      if (changed) {
        channelSessionIds = next;
        channelSessionChannels = channels;
        channelMembershipRevision += 1;
        for (const listener of channelMembershipListeners) listener();
      }
      try { requestHostSessionRefresh(changed); } catch { /* 下次频道轮询继续重试 */ }
    }
    /** IM 会话 ID 包含账号实例；接口映射兼容沿用普通 ID 的已接入会话。 */
    function channelIdOfSession(sessionId) {
      const value = String(sessionId || "");
      const mapped = channelSessionChannels.get(value);
      if (mapped) return mapped;
      if (!value.startsWith("dfc:")) return undefined;
      const rest = value.slice(3);
      const split = rest.indexOf(":");
      const instance = split > 0 ? rest.slice(0, split) : rest;
      const platform = instance.split("_", 1)[0];
      return platform || undefined;
    }
    /** 从 dfc:<account>:<kind>:... 中取出飞书账号 id。 */
    function accountIdOfSession(sessionId) {
      const value = String(sessionId || "");
      if (!value.startsWith("dfc:")) return "";
      const rest = value.slice(4);
      const split = rest.indexOf(":");
      return split > 0 ? rest.slice(0, split) : "";
    }
    const isChannelSession = (id) => String(id).startsWith("dfc:") || channelSessionIds.has(String(id));
    const subscribeChannelMembership = (listener) => {
      channelMembershipListeners.add(listener);
      return () => channelMembershipListeners.delete(listener);
    };
    const channelMembershipSnapshot = () => channelMembershipRevision;

    /** 飞书会话自动认领“飞书频道”页签；其他插件的页签不抢。 */
    function sidebarTabForSession(currentId, extraTabs) {
      if (typeof currentId !== "string" || currentId === "") return null;
      if (isChannelSession(currentId)) return "feishu";
      const matched = (extraTabs || []).find((item) => item && item.matchSession && item.matchSession(currentId));
      if (matched && matched.id !== "schedule" && matched.id !== "channels") return matched.id;
      if (matched) return null;
      return "tasks";
    }

    function followSidebarTab(state, currentId, extraTabs) {
      const ready = !!(state && state.ready);
      const next = sidebarTabForSession(currentId, extraTabs);
      // 首个有效主会话只建立基线，不覆盖用户恢复的页签；空快照继续等待。
      if (!ready) return { ready: typeof currentId === "string" && currentId !== "", previousId: currentId, tab: null };
      if (typeof currentId !== "string" || currentId === "") return { ready: true, previousId: currentId, tab: null };
      if (currentId === state.previousId) return { ready: true, previousId: currentId, tab: null };
      return { ready: true, previousId: currentId, tab: next };
    }

    function resolveSidebarTab(tab, extraTabs) {
      return tab === "tasks" || tab === "feishu" || extraTabs.some((item) => item.id === tab) ? tab : "tasks";
    }

    function isHostNewSessionControl(label) {
      return /^(新会话|新建任务|New chat|New session)(?:\s+(?:Ctrl|Alt|Shift|Meta)(?:\+[^\s+]+)*)?$/i.test(String(label || "").trim());
    }

    const api = (path, opts) => {
      // 管理路由复用宿主登录 Cookie，不缓存账号状态或认证错误。
      const request = Object.assign({}, opts || {}, { credentials: "same-origin", cache: "no-store" });
      const method = String(request.method || "GET").toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        request.headers = Object.assign({ "content-type": "application/json" }, request.headers || {}, { "x-dsh-feishu-channels-client": "1" });
        if (request.body === undefined) request.body = "{}";
      }
      return fetch(API_BASE + path, request).then((r) => r.json()).then((data) => {
        if (!request.signal?.aborted && data.ok && Array.isArray(data.groups)) updateChannelMembership(data.groups);
        return data;
      });
    };

    // One request and timer for all channel consumers. Schedule only after settlement.
    function createChannelRefreshStore(load) {
      const listeners = new Set();
      let flight = null, timer = null, latest = null, failures = 0, epoch = 0;
      const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
      const clearTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };
      const notify = (data, error) => { for (const listener of listeners) listener(data, error); };
      const schedule = () => {
        clearTimer();
        if (listeners.size && visible()) timer = setTimeout(() => {
          timer = null;
          refresh().catch(() => undefined);
        }, Math.min(4000 * 2 ** failures, 60000));
      };
      function refresh() {
        if (flight) return flight.promise;
        clearTimer();
        const current = { controller: new AbortController(), promise: null };
        flight = current;
        current.promise = Promise.resolve().then(() => {
          current.controller.signal.throwIfAborted();
          return load(current.controller.signal);
        }).then(data => {
          if (flight !== current || current.controller.signal.aborted) return data;
          failures = data.ok ? 0 : failures + 1;
          latest = { data, error: null };
          notify(data, null);
          return data;
        }).catch(error => {
          if (flight === current && !current.controller.signal.aborted) {
            failures++;
            latest = { data: null, error };
            notify(null, error);
          }
          throw error;
        }).finally(() => {
          if (flight !== current) return;
          flight = null;
          schedule();
        });
        return current.promise;
      }
      // A mutation must fetch again after any pre-mutation request has settled.
      function invalidate() {
        const generation = epoch;
        return (flight ? flight.promise.catch(() => undefined) : Promise.resolve()).then(() => {
          if (generation === epoch) return refresh();
        });
      }
      const onVisibility = () => {
        clearTimer();
        if (visible() && listeners.size) refresh().catch(() => undefined);
      };
      function subscribe(listener) {
        listeners.add(listener);
        if (latest) listener(latest.data, latest.error);
        if (listeners.size === 1) {
          if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
          if (visible()) refresh().catch(() => undefined);
        }
        return () => {
          listeners.delete(listener);
          if (listeners.size) return;
          epoch++;
          clearTimer();
          if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
          if (flight) flight.controller.abort();
          flight = null;
          latest = null;
          failures = 0;
        };
      }
      return { subscribe, refresh, invalidate };
    }
    const channelRefresh = createChannelRefreshStore(signal => api("/channels", { signal }));

    const storedAccountSelection = () => {
      try { return window.localStorage.getItem(ACCOUNT_SELECTION_KEY) || ""; }
      catch { return ""; }
    };
    const rememberAccountSelection = (id) => {
      try {
        if (id) window.localStorage.setItem(ACCOUNT_SELECTION_KEY, id);
        else window.localStorage.removeItem(ACCOUNT_SELECTION_KEY);
      } catch { /* Local storage can be unavailable in restricted browser contexts. */ }
    };

    function BrandMark({ id, compact, mono, size }) {
      const svg = (viewBox, children) => h("svg", {
        viewBox,
        width: size || undefined,
        height: size || undefined,
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        "aria-hidden": "true",
      }, children);
      const tone = (color) => mono ? "currentColor" : color;
      if (id === "feishu") {
        return svg("0 0 48 48", [
          h("path", { key: "wing", d: "M10 8c0 1 7 3.5 14.745 16.744 0 0 4.184-4.363 6.255-5.744 1.5-1 2.712-1.332 2.712-1.332C33.712 15.156 29.5 8 28 8z", fill: tone("#00d6b9") }),
          h("path", { key: "head", d: "M43.5 18.5c-1-.667-3.65-1.771-6.5-1.5a15 15 0 0 0-3.288.668S32.5 18 31 19c-2.07 1.38-6.255 5.744-6.255 5.744-1.428 1.397-3.05 2.732-5.245 3.756 0 0 7 3 11.5 3 5.063 0 7-3.5 7-3.5 1.5-3.305 3.5-7 5.5-9.5", fill: tone("#163c9a") }),
          h("path", { key: "body", d: "M4 17.5v17c0 1 6 5.5 15 5.5 10 0 17.05-7.705 19-12 0 0-1.937 3.5-7 3.5-4.5 0-11.5-3-11.5-3-5.117-2.239-10.03-6.577-12.906-9.117C4.974 17.953 4 17.093 4 17.5", fill: tone("#3370ff") }),
        ]);
      }
      return svg("0 0 24 24", [
        h("circle", { key: "bg", cx: 12, cy: 12, r: 12, fill: tone("#8b949e") }),
      ]);
    }

    function Logo({ id, small }) {
      return h("div", { className: small ? "dfc-logo sm" : "dfc-logo", "data-brand": id, "aria-hidden": "true" }, h(BrandMark, { id, compact: small }));
    }

    function feishuTabLabelNode(t) {
      return h("span", { className: "dfc-tab-inline" },
        h("span", {
          className: "dfc-tab-brand",
          "aria-hidden": "true",
          style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, flex: "none" },
        }, h(BrandMark, { id: "feishu", compact: true, mono: true, size: 14 })),
        h("span", null, t("rail.feishu")),
      );
    }

    function isRasterQr(value) {
      return typeof value === "string" && (/^data:image\//i.test(value) || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(value));
    }

    function qrSrc(pairing) {
      if (!pairing) return "";
      if (isRasterQr(pairing.qrImage)) return pairing.qrImage;
      return "";
    }

    const SERVER_TEXT_KEYS = new Map([
      ["未知渠道", "server.unknownChannel"], ["渠道未配置", "server.channelUnconfigured"], ["会话不存在", "server.sessionMissing"],
      ["账号不存在", "server.accountMissing"], ["账号连接失败，请查看本机日志", "server.accountConnectFailed"], ["重新连接失败，请查看本机日志", "server.accountReconnectFailed"],
      ["账号备注不能超过 40 个字符", "server.remarkTooLong"], ["账号备注不能包含换行或控制字符", "server.remarkControl"],
      ["请选择提供商、模型、工作区或权限", "server.selectAccountSettings"], ["请选择提供商和模型", "server.selectModel"], ["请选择工作区", "server.selectWorkspace"], ["请先添加工作区", "server.createWorkspace"], ["请选择权限", "server.selectPermission"], ["凭据不足，无法启动渠道", "server.missingCredentials"],
      ["该渠道不支持扫码绑定", "server.qrUnsupported"], ["二维码已过期", "server.qrExpired"], ["扫码未完成", "server.qrIncomplete"],
      ["未授权：请管理员在设置 → 飞书频道 中批准你的访问。", "server.accessDenied"],
      ["未连接", "account.statusNotConnected"], ["已停止", "status.stopped"], ["长连接已建立", "status.longConnection"],
    ]);
    function serverText(value, t) {
      const text = value == null ? "" : String(value);
      const key = SERVER_TEXT_KEYS.get(text);
      if (key) return t(key);
      // Server adapters return diagnostics, not locale keys. Do not leak a
      // Chinese diagnostic into an English UI; the detailed value remains in
      // the server log while the browser gets a usable localized fallback.
      if (/[\u3400-\u9fff]/.test(text) && t("settings.label") === "Feishu Channel") return t("error.detailsInLog");
      return value;
    }
    async function copyText(value) {
      const text = String(value ?? "");
      if (!text) return false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch { /* fall through to the DOM fallback */ }
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = typeof document.execCommand === "function" ? document.execCommand("copy") : false;
        area.remove();
        return ok;
      } catch { return false; }
    }

    function relativeTime(value, t) {
      const ms = Date.parse(value || "");
      if (!Number.isFinite(ms)) return "";
      const diff = Math.max(0, Date.now() - ms);
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return t("time.now");
      if (minutes < 60) return t("time.ago", { t: t("time.minutes", { n: minutes }) });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t("time.ago", { t: t("time.hours", { n: hours }) });
      const days = Math.floor(hours / 24);
      if (days < 30) return t("time.ago", { t: t("time.days", { n: days }) });
      const months = Math.floor(days / 30);
      if (months < 12) return t("time.ago", { t: t("time.months", { n: months }) });
      return t("time.ago", { t: t("time.years", { n: Math.floor(months / 12) }) });
    }

    function defaultChannelName(ch) {
      const count = Array.isArray(ch && ch.accounts) ? ch.accounts.length : 0;
      return `飞书账号${Math.max(1, count + 1)}`;
    }

    function channelLabel(ch, t) {
      const key = "channel." + ch.id;
      const translated = t(key);
      return translated === key ? (ch.label || ch.id) : translated;
    }
    function accountLabel(account, t) {
      if (!account || !account.autoName) return account && (account.name || account.id) || "";
      return t("account.defaultName", {
        channel: channelLabel({ id: account.platform, label: account.platform }, t),
        count: account.nameOrdinal || 1,
      });
    }
    function fieldLabel(ch, field, t) {
      const key = "field." + ch.id + "." + field.key;
      const translated = t(key);
      return translated === key ? field.label : translated;
    }
    function hintOf(ch, t) {
      const key = "qr." + ch.id;
      const translated = t(key);
      return translated === key ? t("qr.default") : translated;
    }

    // 有 reflect 时只 probe，不能硬读未注入的官方导航服务，否则 Cordis 会挡住插件激活。
    function probeService(ctx, name) {
      if (!ctx) return undefined;
      const reflect = ctx.reflect;
      if (reflect && typeof reflect.get === "function") {
        try {
          const found = reflect.get(name);
          if (found !== undefined) return found;
        } catch { /* 未注入时不硬读 ctx[name]，改走 get */ }
      }
      if (typeof ctx.get === "function") {
        try {
          const found = ctx.get(name);
          if (found !== undefined) return found;
        } catch { return undefined; }
      }
      if (reflect && typeof reflect.get === "function") return undefined;
      try { return ctx[name]; } catch { return undefined; }
    }
    // 旧宿主读 list.current；alpha.2 主视图改由 retainedBy.mainView 标记。
    function currentSessionId(state) {
      if (!state) return null;
      if (typeof state.current === "string" && state.current) return state.current;
      const byId = state.byId || {};
      const ids = Array.isArray(state.ids) && state.ids.length ? state.ids : Object.keys(byId);
      const pick = (id, row) => {
        if (!row || !row.retainedBy || (row.retainedBy.mainView ?? 0) <= 0) return null;
        const explicit = row.id && String(row.id).trim();
        return explicit || id;
      };
      for (let i = 0; i < ids.length; i++) {
        const found = pick(ids[i], byId[ids[i]]);
        if (found) return found;
      }
      for (const id in byId) {
        if (ids.indexOf(id) !== -1) continue;
        const found = pick(id, byId[id]);
        if (found) return found;
      }
      return null;
    }
    function resolveHostSessionId(sessionId, sessionById) {
      if (!sessionId) return sessionId;
      const listed = sessionById && sessionById[sessionId];
      const fromKey = listed && (listed.id || listed.sessionId);
      if (fromKey && String(fromKey).trim()) return String(fromKey).trim();
      return sessionId;
    }

    function mainSessionModel(state) {
      const id = currentSessionId(state);
      const row = id && state && state.projectionsBySession && state.projectionsBySession[id];
      const selection = row && row.values && row.values.modelSelection;
      const next = selection && (selection.next || selection.lastUsed);
      if (!next || !next.provider || !next.model) return null;
      return { provider: next.provider, model: next.model, reasoningEffort: next.reasoningEffort || "" };
    }
    function readMainSessionModel(ctx) {
      const sessions = probeService(ctx, "sessions");
      const list = sessions && sessions.list;
      if (!list || typeof list.getSnapshot !== "function") return null;
      try { return mainSessionModel(list.getSnapshot()); } catch { return null; }
    }
    function openHostSession(ctx, id) {
      if (!id) return false;
      const uiWorkspace = probeService(ctx, "uiWorkspace");
      if (uiWorkspace && typeof uiWorkspace.openSession === "function") {
        uiWorkspace.openSession(id);
        return true;
      }
      // alpha.2 有 retain：旧的 sessions.open 即使还在也不会写入 mainView，点了等于没打开。
      if (ctx.sessions && typeof ctx.sessions.retain === "function") return false;
      if (ctx.sessions && typeof ctx.sessions.open === "function") {
        ctx.sessions.open(id);
        return true;
      }
      return false;
    }
    function parsePickedPath(value) {
      if (typeof value === "string" && value.trim() !== "") return value;
      if (value === null || typeof value !== "object") return undefined;
      if (value.canceled === true) return undefined;
      if (typeof value.path === "string" && value.path.trim() !== "") return value.path;
      const first = Array.isArray(value.filePaths) ? value.filePaths[0] : undefined;
      return typeof first === "string" && first.trim() !== "" ? first : undefined;
    }
    function pickHostDirectory(ctx) {
      const host = typeof globalThis !== "undefined" ? globalThis.__DSH_DIRECTORY_PICKER__ : undefined;
      if (host && typeof host.pick === "function") {
        return Promise.resolve(host.pick()).then(parsePickedPath);
      }
      const uiWorkspace = probeService(ctx, "uiWorkspace");
      if (uiWorkspace && typeof uiWorkspace.pickDirectory === "function") return Promise.resolve(uiWorkspace.pickDirectory()).then(parsePickedPath);
      const dialog = probeService(ctx, "dialog");
      if (dialog && typeof dialog.pickDirectory === "function") return Promise.resolve(dialog.pickDirectory()).then(parsePickedPath);
      if (ctx && ctx.workspaces && typeof ctx.workspaces.pickDirectory === "function") return Promise.resolve(ctx.workspaces.pickDirectory()).then(parsePickedPath);
      // 全部来源都不可用时必须显式拒绝：调用方据此提示“当前 Host 无法新增工作区”，
      // 否则点击“添加工作区…”会静默无响应（取消选择由 resolve(undefined) 表示，二者不能混淆）。
      return Promise.reject(workspacePickerUnavailable());
    }
    function workspacePickerUnavailable() {
      const error = new Error("workspace picker unavailable");
      error.code = "workspace/picker-unavailable";
      return error;
    }
    function hostWorkspaceApi(ctx) {
      return probeService(ctx, "uiWorkspace") || ctx.workspaces || {};
    }
    function archiveHostSession(ctx, id, options) {
      const api = hostWorkspaceApi(ctx);
      if (typeof api.archiveSession !== "function") return;
      return options ? api.archiveSession(id, options) : api.archiveSession(id);
    }
    function unarchiveHostSession(ctx, id) {
      const api = hostWorkspaceApi(ctx);
      if (typeof api.unarchiveSession === "function") return api.unarchiveSession(id);
      if (typeof api.restoreSession === "function") return api.restoreSession(id);
    }
    function forkHostSession(ctx, id) {
      const uiWorkspace = probeService(ctx, "uiWorkspace");
      if (uiWorkspace && typeof uiWorkspace.forkSession === "function") return Promise.resolve(uiWorkspace.forkSession(id));
      if (!ctx.sessions || typeof ctx.sessions.fork !== "function") return Promise.resolve();
      return ctx.sessions.fork({ sessionId: id, increaseTitle: true })
        .then((childId) => { openHostSession(ctx, childId); })
        .catch(() => undefined);
    }
    async function renameHostSession(ctx, sessionId, title) {
      const sessions = ctx.sessions;
      if (!sessions) throw new Error("unknown session");
      const renameBound = async (session) => {
        if (!session || typeof session.rename !== "function") throw new Error("unknown session");
        const result = await session.rename(title);
        if (result && result.ok === false) throw new Error((result.error && result.error.message) || "rename failed");
      };
      if (typeof sessions.using === "function") {
        return sessions.using(sessionId, { source: "controllerOperation" }, async (reference) => {
          if (reference && reference.ready) await reference.ready;
          return renameBound(reference && reference.binding && reference.binding.session);
        });
      }
      const existing = sessions.binding && sessions.binding(sessionId);
      if (existing && existing.session) return renameBound(existing.session);
      if (typeof sessions.retain !== "function") throw new Error("unknown session");
      const ref = sessions.retain(sessionId, { source: "controllerOperation" });
      try {
        if (ref && ref.ready) await ref.ready;
        return renameBound(ref && ref.binding && ref.binding.session);
      } finally {
        if (ref && typeof ref.release === "function") ref.release();
      }
    }

    let openImSession = (id) => {
      try {
        if (window.__dshSessionsOpen) { window.__dshSessionsOpen(id); return true; }
      } catch { /* ignore */ }
      return false;
    };
    const tryOpenListedSession = (id, hostOpen) => {
      if (openImSession(id)) return true;
      if (typeof hostOpen !== "function") return false;
      try { hostOpen(id); return true; } catch { return false; }
    };
    const openListedSession = (id, hostOpen) => {
      if (!id) return;
      if (isChannelSession(id)) {
        api("/sessions/ensure", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: id }),
        }).then((data) => {
          if (!data.ok) { console.warn("[dsh-feishu-channels] 无法恢复会话", data.error || id); return; }
          const tryOpen = (left) => {
            if (openImSession(id) || left <= 0) return;
            setTimeout(() => tryOpen(left - 1), 80);
          };
          tryOpen(20);
        }).catch((error) => console.warn("[dsh-feishu-channels] 无法恢复会话", id, error));
        return;
      }
      tryOpenListedSession(id, hostOpen);
    };

    function preferredAssistant(defaults, readModel) {
      const main = typeof readModel === "function" ? readModel() : null;
      if (main && main.provider && main.model) return main;
      const assistant = defaults && defaults.assistant;
      return assistant && assistant.provider && assistant.model ? assistant : null;
    }
    function selectableWorkspace(preferred, workspaces) {
      const items = Array.isArray(workspaces) ? workspaces : [];
      const key = (path) => {
        const value = String(path || "");
        const windows = /^[a-z]:[\\/]|^\\\\|^\/\//i.test(value);
        const normalized = (windows ? value.replace(/\\/g, "/") : value).replace(/\/+$/, "");
        return windows ? normalized.toLowerCase() : normalized;
      };
      const wanted = key(preferred);
      const matched = wanted && items.find((item) => item && key(item.path) === wanted);
      if (matched && matched.path) return matched.path;
      const first = items.find((item) => item && item.path);
            return first ? first.path : "";
                }
                function workspaceIsListed(cwd, workspaces) {
                  const items = Array.isArray(workspaces) ? workspaces : [];
                  const key = (path) => {
                    const value = String(path || "");
                    const windows = /^[a-z]:[\\/]|^\\\\|^\/\//i.test(value);
                    const normalized = (windows ? value.replace(/\\/g, "/") : value).replace(/\/+$/, "");
                    return windows ? normalized.toLowerCase() : normalized;
                  };
                  const wanted = key(cwd);
                  return Boolean(wanted && items.some((item) => item && key(item.path) === wanted));
                }
                function BindModal({ ch, onClose, onConnected, catalog, permissions, agentPresets, workspaces, defaults, readMainSessionModel, createWorkspace, pickDirectory, modelT, permissionT, presetT, t = fallbackT }) {
      const hasQr = ch.kind === "qr" || ch.kind === "qr-or-credentials";
      const hasManual = false;
      const showTabs = false;
      const [tab, setTab] = useState("qr");
      const [pairing, setPairing] = useState(null);
      const [qrStarted, setQrStarted] = useState(false);
      const [draft, setDraft] = useState({});
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const [success, setSuccess] = useState("");
      const modelTouched = useRef(false);
      const workspaceTouched = useRef(false);
      const [settings, setSettings] = useState(() => {
        const assistant = preferredAssistant(defaults, readMainSessionModel);
        return {
          name: defaultChannelName(ch),
          cwd: selectableWorkspace(defaults && defaults.cwd, workspaces),
          provider: assistant && assistant.provider || "",
          model: assistant && assistant.model || "",
          reasoningEffort: assistant && assistant.reasoningEffort || "",
          permission: defaults && defaults.permission || "",
          privateAccess: "approved",
          sendMode: "queue",
          agentPreset: defaults && defaults.agentPreset || "standard",
        };
      });
      const alive = useRef(true);
      useEffect(() => {
        if (modelTouched.current) return;
        const assistant = preferredAssistant(defaults, readMainSessionModel);
        if (!assistant) return;
        setSettings((current) => current.provider === assistant.provider && current.model === assistant.model
          ? current
          : { ...current, provider: assistant.provider, model: assistant.model, reasoningEffort: assistant.reasoningEffort || "" });
      }, [defaults, readMainSessionModel]);
      useEffect(() => {
        if (workspaceTouched.current) return;
        const next = selectableWorkspace(defaults && defaults.cwd, workspaces);
        setSettings((current) => current.cwd === next ? current : { ...current, cwd: next });
      }, [defaults, workspaces]);

      const startQr = useCallback((refresh) => {
              if (!hasQr || !workspaceIsListed(settings.cwd, workspaces)) return;
        setQrStarted(true);
        setBusy(true);
        setError("");
        setSuccess("");
        api(`/channels/${ch.id}/qr/${refresh ? "refresh" : "start"}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ settings }),
        }).then((data) => {
          if (!alive.current) return;
          if (!data.ok && !data.pairing) setError(serverText(data.error, t) || t("error.qr"));
          setPairing(data.pairing || null);
        }).catch(() => { if (alive.current) setError(t("error.qr")); })
          .finally(() => { if (alive.current) setBusy(false); });
      }, [ch.id, hasQr, settings, workspaces]);

      useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
      }, []);

      const finished = useRef(false);
      const onConnectedRef = useRef(onConnected);
      onConnectedRef.current = onConnected;
      const finish = (delayMs) => {
        if (finished.current) return;
        finished.current = true;
        alive.current = false;
        window.setTimeout(() => onConnectedRef.current(), delayMs);
      };

      useEffect(() => {
        if (tab !== "qr" || !qrStarted) return undefined;
        const timer = setInterval(() => {
          api(`/channels/${ch.id}/qr/status`).then((data) => {
            if (finished.current || !alive.current || !data.ok) return;
            setPairing(data.pairing);
            if (data.pairing && data.pairing.status === "success") finish(800);
          }).catch(() => undefined);
        }, 2000);
        return () => clearInterval(timer);
      }, [tab, ch.id, qrStarted]);

      const status = qrStarted && pairing && pairing.status;
      const saving = status === "saving";
      const close = () => {
        if (finished.current || saving) return;
        alive.current = false;
        if (hasQr) api("/channels/" + ch.id + "/qr/cancel", { method: "POST" }).catch(() => undefined);
        onClose();
      };
      const onCloseRef = useRef(onClose);
      onCloseRef.current = onClose;
      useEffect(() => {
        const onKeyDown = (event) => {
          if (modalLayers.length && modalLayers[modalLayers.length - 1].owner !== "bind") return;
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
          if (saving) return;
          alive.current = false;
          if (hasQr) api("/channels/" + ch.id + "/qr/cancel", { method: "POST" }).catch(() => undefined);
          onCloseRef.current();
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
      }, [hasQr, ch.id, saving]);

      const saveManual = () => {
              if (!workspaceIsListed(settings.cwd, workspaces)) {
                setError(t("composer.workspaceRequired"));
                return;
              }
              const config = { ...draft };
        setBusy(true);
        setError("");
        setSuccess("");
        api(`/channels/${ch.id}/connect`, {
          method: "POST",
          headers: { "content-type": "application/json" },
           body: JSON.stringify({ config, settings }),
        }).then((data) => {
          if (!data.ok) setError(serverText(data.error, t) || t("error.save"));
          else {
            setSuccess(data.newIdentity ? t("bind.newIdentity") : t("bind.success"));
            finish(data.newIdentity ? 1400 : 500);
          }
        }).catch(() => setError(t("error.save"))).finally(() => setBusy(false));
      };

      const switchTab = (next) => {
        if (saving) return;
        setTab(next);
        setError("");
        setSuccess("");
        if (next !== "qr") {
          setQrStarted(false);
          setPairing(null);
          api(`/channels/${ch.id}/qr/cancel`, { method: "POST" }).catch(() => undefined);
        }
      };

      const src = qrStarted ? qrSrc(pairing) : "";
      const remain = qrStarted && pairing && pairing.remainingSeconds;

      return h(Modal, {
        open: true,
        className: "dfc-bind-modal",
        title: t("bind.title", { channel: channelLabel(ch, t) }),
        width: 720,
        zIndex: 1100,
        destroyOnHidden: true,
        layerOwner: "bind",
        maskClosable: !saving,
        onCancel: close,
        footer: tab === "manual" && hasManual
          ? h("div", { className: "dfc-modal-actions" },
              hostModalButton(t("action.cancel"), close, "outline", { disabled: busy }),
              hostModalButton(busy ? t("action.saving") : t("action.confirm"), saveManual, "primary", { disabled: busy || !workspaceIsListed(settings.cwd, workspaces) }),
            )
          : null,
      },
        showTabs && h("div", {
          className: ["dfc-bind-tabs-wrap", saving ? "is-disabled" : ""].filter(Boolean).join(" "),
          "aria-disabled": saving ? "true" : undefined,
        }, h(HostSegmentedTabs, {
          className: "dfc-bind-tabs",
          label: t("bind.tabsAria"),
          value: tab,
          onChange: (next) => switchTab(next),
          items: [
            { value: "qr", id: "dfc-bind-tab-qr", panelId: "dfc-bind-panel-qr", label: t("bind.quick") },
            { value: "manual", id: "dfc-bind-tab-manual", panelId: "dfc-bind-panel-manual", label: t("bind.manual") },
          ],
        })),
        error && h(NoticeBar, { type: "error" }, error),
        success && h(NoticeBar, { type: "success" }, success),
        h("label", { className: "dfc-field dfc-channel-name-field" },
          h("span", { className: "dfc-picker-label" }, t("account.channelName")),
          h(Input, {
            type: "text",
            value: settings.name || "",
            placeholder: defaultChannelName(ch),
            onChange: (event) => setSettings((current) => ({ ...current, name: event.target.value })),
          }),
        ),
        h("div", { className: "dfc-setup-section" },
          h(AccountSettingsPicker, {
            value: settings,
            onChange: (patch) => {
              if (patch && patch.cwd !== undefined) workspaceTouched.current = true;
              if (patch && (patch.provider !== undefined || patch.model !== undefined)) modelTouched.current = true;
              setSettings((current) => ({ ...current, ...patch }));
            },
            catalog,
            permissions,
            agentPresets,
            workspaces,
            createWorkspace,
            pickDirectory,
            modelT,
            permissionT,
            presetT,
            showAutoNameNote: false,
            t,
          }),
          h(CommandPermissionSettings, { value: settings.commandPermissions, onSave: commandPermissions => setSettings(current => ({ ...current, commandPermissions })), t }),
        ),
        hasQr && h("div", showTabs ? { className: "dfc-bind-panel", id: "dfc-bind-panel-qr", role: "tabpanel", "aria-labelledby": "dfc-bind-tab-qr", hidden: tab !== "qr" } : null,
          status === "success"
            ? h(NoticeBar, { type: "success" }, t("bind.success"))
            : status === "saving"
              ? h("div", { className: "dfc-bind-status" }, t("bind.saving"))
            : src
              ? h("div", { className: "dfc-qrbox" },
                h("p", { className: "dfc-hint" }, hintOf(ch, t)),
                h("img", { src, alt: t("bind.qrAlt", { channel: channelLabel(ch, t) }) }),
                remain > 0 && h("p", { className: "dfc-hint" }, t("bind.expire", { time: Math.floor(remain / 60) + ":" + String(remain % 60).padStart(2, "0") })),
                status === "scanned" && h("p", { className: "dfc-hint" }, t("bind.scanned")),
                (status === "expired" || status === "failed") && h("p", { className: "dfc-error" }, serverText(pairing && pairing.error, t) || t("bind.retry")),
                hostModalButton(t("bind.refresh"), () => startQr(true), "outline", { disabled: busy }),
              )
              : h("div", { className: "dfc-bind-ready" },
                  h("p", { className: "dfc-hint" }, hintOf(ch, t)),
                  (busy || status === "starting") && h("div", { className: "dfc-bind-status" }, t("bind.generating")),
                  (status === "expired" || status === "failed") && h("div", { className: "dfc-error" }, serverText(pairing && pairing.error, t) || t("bind.retry")),
                  hostModalButton(busy ? t("bind.generating") : qrStarted ? t("bind.refresh") : t("action.generateQr"), () => startQr(qrStarted), "primary", { disabled: busy || !workspaceIsListed(settings.cwd, workspaces) || !settings.provider || !settings.model || !settings.permission }),
                )
        ),
        hasManual && h("div", showTabs ? { className: "dfc-bind-panel", id: "dfc-bind-panel-manual", role: "tabpanel", "aria-labelledby": "dfc-bind-tab-manual", hidden: tab !== "manual" } : null,
          ...ch.fields.filter((f) => !f.settingsOnly).map((f) => h("label", { key: f.key, className: "dfc-field" },
            fieldLabel(ch, f, t),
            h(Input, {
              type: f.secret ? "password" : "text",
              value: draft[f.key] || "",
              placeholder: fieldLabel(ch, f, t),
              onChange: (e) => setDraft({ ...draft, [f.key]: e.target.value }),
            }),
          )),
        ),
      );
    }

    const BUILT_IN_PERMISSION_LABELS = new Map([
      ["read-only", ["permission.readOnly", "Read Only"]],
      ["workspace-write", ["permission.workspaceWrite", "Workspace Write"]],
      ["danger-full-access", ["permission.fullAccess", "Full access"]],
    ]);

    function permissionLabel(option, t) {
      const builtIn = BUILT_IN_PERMISSION_LABELS.get(option.value);
      if (builtIn && (option.name === option.value || option.name === builtIn[1])) return t(builtIn[0]);
      return option.name || option.value;
    }

    // 与宿主 settings.agentPreset 一致：内置预设没有自报名称时走官方词条。
    const BUILT_IN_PRESET_KEYS = {
      standard: { name: "presetStandardName", description: "presetStandardDescription" },
      ptc: { name: "presetPtcName", description: "presetPtcDescription" },
      minimal: { name: "presetMinimalName", description: "presetMinimalDescription" },
      cordis: { name: "presetCordisName", description: "presetCordisDescription" },
    };
    function presetDisplayText(preset, presetT) {
      const keys = BUILT_IN_PRESET_KEYS[preset.id];
      if (keys && (preset.name === undefined || preset.name === "" || preset.name === preset.id)) {
        return { name: presetT(keys.name), description: presetT(keys.description) };
      }
      return { name: preset.name || preset.id, description: preset.description };
    }
    function PlusIcon() {
      return h(IconPlusOutline, { size: 14 });
    }

    function formatProviderLabel(provider, defaultLabel, modelT) {
      if (provider === "deepseek-account") {
        const localized = modelT("provider.account");
        if (localized && localized !== "provider.account") return localized;
      }
      return defaultLabel;
    }

    function orderProviders(left, right) {
      const leftRank = left === "deepseek-account" ? 0 : left === "deepseek-official" ? 1 : 2;
      const rightRank = right === "deepseek-account" ? 0 : right === "deepseek-official" ? 1 : 2;
      return leftRank - rightRank;
    }

    function renderModelOptionLabel(item) {
      const isOfficialFlash = (item.provider === "deepseek-account" || item.provider === "deepseek-official") && item.model === "deepseek-flash";
      if (!isOfficialFlash) return item.label;
      return React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 } },
        React.createElement("span", null, item.label),
        React.createElement(Tag, { color: "info" }, "1017")
      );
    }

    function AccountSettingsPicker(props) {
      const t = props.t || fallbackT;
      const modelT = props.modelT || ((key) => key);
      const permissionT = props.permissionT || ((key) => key);
      const presetT = props.presetT || ((key) => key);
      const value = props.value || {};
      const [addBusy, setAddBusy] = useState(false);
      const [hint, setHint] = useState("");
      const [confirmingFullAccess, setConfirmingFullAccess] = useState(false);
      const [fullAccessAcknowledged, setFullAccessAcknowledged] = useState(false);
      const items = props.workspaces || [];
      const providers = props.catalog || [];
      const permissions = props.permissions || [];
      const provider = value.provider || (value.assistant && value.assistant.provider) || "";
      const model = value.model || (value.assistant && value.assistant.model) || "";
      const effort = value.reasoningEffort || (value.assistant && value.assistant.reasoningEffort) || "";
      const cwd = value.cwd || "";
      const permission = value.permission || "";
      const privateAccess = value.privateAccess === "all" ? "all" : "approved";
      const sendMode = value.sendMode === "steer" ? "steer" : "queue";
      const workspace = items.find((item) => item.path === cwd);
      const modelGroups = providers.map((item) => {
        const providerName = formatProviderLabel(item.id, item.name || item.id, modelT);
        return {
          id: item.id,
          name: providerName,
          models: (item.models || []).map((entry) => ({
            value: item.id + "::" + entry.id,
            provider: item.id,
            providerName: providerName,
            model: entry.id,
            label: entry.name || entry.id,
            description: entry.description,
            reasoning: entry.reasoning,
          })),
        };
      }).filter((item) => item.models.length > 0).sort((left, right) => orderProviders(left.id, right.id));
      const models = modelGroups.flatMap((item) => item.models);
      const currentModel = models.find((item) => item.provider === provider && item.model === model);
      const reasoning = currentModel && currentModel.reasoning;
      const effectiveEffort = effort || (reasoning && reasoning.defaultEffort) || "";
      const efforts = reasoning
        ? [
            ...(reasoning.defaultEffort ? [] : [{ id: "", name: modelT("effort.providerDefault") }]),
            ...((reasoning.efforts || []).map((item) => ({ id: item.id, name: item.name || item.id, description: item.description }))),
          ]
        : [];
      const effortLabel = reasoning
        ? ((efforts.find((item) => item.id === effectiveEffort) || {}).name || effectiveEffort || modelT("effort.providerDefault"))
        : "";
      const permissionOptions = permissions.map((item) => ({ ...item, label: permissionLabel(item, t) }));
      const currentPermission = permissionOptions.find((item) => item.value === permission);
      const update = (patch) => {
        setHint("");
        if (typeof props.onChange === "function") props.onChange(patch);
      };

      const addWorkspace = (path) => {
        const next = (path || "").trim();
        if (!next) { setHint(t("error.chooseWorkspace")); return Promise.resolve(); }
        if (typeof props.createWorkspace !== "function") { setHint(t("error.workspaceUnavailable")); return Promise.resolve(); }
        setAddBusy(true);
        return Promise.resolve(props.createWorkspace({ path: next })).then((created) => {
          const cwdPath = (created && (created.path || created.cwd)) || next;
          update({ cwd: cwdPath });
        }).catch((error) => setHint((error && error.message) || t("error.addWorkspace")))
          .finally(() => setAddBusy(false));
      };
      const onAddWorkspace = () => {
        setHint("");
        if (typeof props.pickDirectory !== "function") {
          setHint(t("error.workspaceUnavailable"));
          return Promise.resolve();
        }
        setAddBusy(true);
        return Promise.resolve()
          .then(() => props.pickDirectory())
          .then((picked) => {
            if (typeof picked === "string" && picked.trim()) {
              return addWorkspace(picked);
            }
          })
          .catch((error) => {
            setHint(error && error.code === "workspace/picker-unavailable"
              ? t("error.workspaceUnavailable")
              : (error && error.message) || t("error.addWorkspace"));
          })
          .finally(() => {
            setAddBusy(false);
          });
      };
      const selectPermission = (next) => {
        if (next === permission) return;
        if (next === "danger-full-access") {
          setFullAccessAcknowledged(false);
          setConfirmingFullAccess(true);
          return;
        }
        update({ permission: next });
      };
      const field = (key, label, picker, wide) => h("div", { key, className: "dfc-picker-field" + (wide ? " wide" : "") },
        h("span", { className: "dfc-picker-label" }, label),
        picker,
      );

      return h("div", { className: "dfc-account-settings" + (props.compact ? " compact" : "") },
        field("workspace", props.workspaceLabel || t("account.workspace"), items.length === 0
          ? h("div", null,
              h(Button, { variant: "primary", icon: h(PlusIcon), disabled: addBusy, onClick: onAddWorkspace }, t("composer.addWorkspace")),
              h("div", { className: "dfc-picker-note warning" }, t("composer.workspaceRequired")),
            )
          : h(Select, {
          className: "dfc-account-picker dfc-workspace-picker",
          value: cwd || undefined,
          placeholder: t("account.selectWorkspace"),
          "aria-label": props.workspaceLabel || t("account.workspace"),
          popupMatchSelectWidth: false,
          options: items.map((item) => ({ value: item.path, label: item.title || item.path })),
          footer: [{ value: "add-workspace", label: t("composer.addWorkspace"), disabled: addBusy }],
          onFooter: () => { onAddWorkspace(); },
          notFoundContent: t("composer.noWorkspaces"),
          onChange: (next) => update({ cwd: next }),
        })),
        field("agentPreset", presetT("nav"), h(Select, {
          className: "dfc-account-picker",
          value: value.agentPreset || undefined,
          "aria-label": presetT("nav"),
          options: (props.agentPresets || []).map((item) => {
            const copy = presetDisplayText(item, presetT);
            return {
              value: item.id,
              label: copy.name,
              disabled: !!item.broken,
              title: item.broken ? t("account.presetUnavailable") : copy.description,
            };
          }),
          onChange: (next) => update({ agentPreset: next }),
        })),
        h("div", { key: "model-effort", className: "dfc-model-effort" },
          field("model", modelT("menu.model"), h(Select, {
            className: "dfc-account-picker dfc-model-select",
            value: currentModel ? currentModel.value : undefined,
            placeholder: t("account.selectModel"),
            title: currentModel && currentModel.label,
            "aria-label": modelT("trigger.selectAria"),
            popupMatchSelectWidth: false,
            options: modelGroups.map((group) => ({
              label: group.name,
              options: group.models.map((item) => ({ value: item.value, label: renderModelOptionLabel(item) })),
            })),
            notFoundContent: modelT("empty.models"),
            onChange: (next) => {
              const item = models.find((entry) => entry.value === next);
              if (!item) return;
              update({ provider: item.provider, model: item.model, reasoningEffort: (item.reasoning && item.reasoning.defaultEffort) || "" });
            },
          })),
          reasoning && field("effort", modelT("menu.effort"), h(Select, {
            className: "dfc-account-picker",
            value: effectiveEffort,
            "aria-label": modelT("menu.effort"),
            options: efforts.map((item) => ({ value: item.id, label: item.name })),
            onChange: (next) => update({ provider, model, reasoningEffort: next }),
          })),
        ),
        field("permission", t("composer.permission"), h(Select, {
          className: "dfc-account-picker",
          value: permission || undefined,
          placeholder: t("account.selectPermission"),
          "aria-label": t("composer.permission"),
          options: permissionOptions.map((item) => ({ value: item.value, label: item.label })),
          onChange: selectPermission,
        })),
        field("private", t("account.privateAccess"), h(Select, {
          className: "dfc-account-picker",
          value: privateAccess,
          "aria-label": t("account.privateAccess"),
          options: [
            { value: "approved", label: t("account.privateApproved") },
            { value: "all", label: t("account.privateAll") },
          ],
          onChange: (next) => update({ privateAccess: next }),
        })),
        field("sendMode", t("account.sendMode"), h(Select, {
          className: "dfc-account-picker",
          value: sendMode,
          "aria-label": t("account.sendMode"),
          options: [
            { value: "queue", label: t("account.sendQueue") },
            { value: "steer", label: t("account.sendSteer") },
          ],
          onChange: (next) => update({ sendMode: next }),
        })),
        h("div", { className: "dfc-picker-note" }, t("account.presetNote")),
        sendMode === "steer" && h("div", { className: "dfc-picker-note" }, t("account.sendSteerNote")),
        privateAccess === "all" && h("div", { className: "dfc-picker-note warning" }, t("settings.publicChatNotice")),
        hint && h("div", { className: "dfc-picker-note" }, hint),
        props.showAutoNameNote && h("div", { className: "dfc-picker-note" }, t("account.autoNameNote")),
        h(Modal, {
          open: confirmingFullAccess,
          layerOwner: "full-access",
          title: permissionT("confirm.title"),
          keyboard: false,
          maskClosable: false,
          okText: permissionT("confirm.enable"),
          cancelText: permissionT("confirm.cancel"),
          okButtonProps: { disabled: !fullAccessAcknowledged },
          onCancel: () => { setFullAccessAcknowledged(false); setConfirmingFullAccess(false); },
          onOk: () => {
            if (!fullAccessAcknowledged) return;
            update({ permission: "danger-full-access" });
            setFullAccessAcknowledged(false);
            setConfirmingFullAccess(false);
          },
        },
          h("p", null, permissionT("confirm.description")),
          h(Checkbox, { checked: fullAccessAcknowledged, onChange: (event) => setFullAccessAcknowledged(event.target.checked) }, permissionT("confirm.acknowledge")),
        ),
      );
    }

    // 与账号配置共用两列网格和 Ant 下拉，私聊与群聊分别保存。
    function CommandPermissionSettings({ value, onSave, t }) {
      const policy = value || { dm: { enabled: true, users: [] }, group: { enabled: true, users: [] } };
      return h("div", { className: "dfc-command-permissions dfc-account-settings" },
        ...["dm", "group"].map(kind => h("div", { key: kind, className: "dfc-picker-field" },
          h("span", { className: "dfc-picker-label" }, t("command." + kind)),
          h(Select, {
            className: "dfc-account-picker",
            value: policy[kind].enabled ? "on" : "off",
            "aria-label": t("command." + kind),
            options: [
              { value: "on", label: t("command.enabled") },
              { value: "off", label: t("command.disabled") },
            ],
            onChange: (next) => onSave({ dm: { enabled: policy.dm.enabled, users: [] }, group: { enabled: policy.group.enabled, users: [] }, [kind]: { enabled: next === "on", users: [] } }),
          }))));
    }

    function AccountConnectionCheck({ account, t }) {
      const diagnostics = account.diagnostics;
      return h("div", { className: "dfc-connection-check", role: "status", "aria-live": "polite" },
        h("strong", null, t("diagnostic.title")),
        h("div", null, t("connection.checkedAt") + ": ", h("time", { dateTime: diagnostics.checkedAt }, new Date(diagnostics.checkedAt).toLocaleString(t("settings.label") === "Feishu Channel" ? "en-US" : "zh-CN"))),
        diagnostics.checks.map(item => h("div", { className: "dfc-diagnostic-item", key: item.id },
          h("div", { className: "dfc-diagnostic-head" },
            h("strong", null, t("diagnostic." + item.id)),
            h(Tag, { color: item.status === "passed" ? "success" : item.status === "failed" ? "error" : "warning" }, t("diagnostic." + item.status)),
          ),
          h("div", null, t("diagnostic." + item.reason)),
          h("small", null, [item.durationMs == null ? null : item.durationMs + " ms", item.httpStatus == null ? null : "HTTP " + item.httpStatus, item.platformCode == null ? null : "Code " + item.platformCode].filter(Boolean).join(" · ")),
        )),
        h("div", null, t(account.receiveConfigured === true ? "connection.receiveOn" : account.receiveConfigured === false ? "connection.receiveOff" : "connection.receiveUnknown")),
        h("div", null, t("diagnostic.scope")),
      );
    }

    function AccountInspector({ account, catalog, permissions, agentPresets, workspaces, createWorkspace, pickDirectory, modelT, permissionT, presetT, t, onAction, onSave, busy }) {
      const [modal, modalHolder] = Modal.useModal();
      const [draft, setDraft] = useState(account);
      const [note, setNote] = useState("");
      const [checkResult, setCheckResult] = useState(null);
      const [checkFailed, setCheckFailed] = useState(false);
      const [checking, setChecking] = useState(false);
      const [checkOpen, setCheckOpen] = useState(true);
      const checkRequest = useRef(0);
      const checkPending = useRef(false);
      const [secretVisible, setSecretVisible] = useState(false);
      const [secretValue, setSecretValue] = useState("");
      const [secretBusy, setSecretBusy] = useState(false);
      const [copied, setCopied] = useState("");
      useEffect(() => {
        setSecretVisible(false);
        setSecretValue("");
        setCopied("");
      }, [account.id]);
      const markCopied = (kind) => {
        setCopied(kind);
        window.setTimeout(() => setCopied((current) => current === kind ? "" : current), 1500);
      };
      const loadSecret = async () => {
        if (secretValue) return secretValue;
        setSecretBusy(true);
        try {
          const data = await api(`/accounts/${account.id}/secret`, { method: "POST", body: "{}" });
          if (data.ok && data.appSecret) {
            setSecretValue(data.appSecret);
            return data.appSecret;
          }
        } catch { /* keep hidden */ }
        finally { setSecretBusy(false); }
        return "";
      };
      const revealSecret = async () => {
        if (!account.hasAppSecret) return;
        if (secretVisible) { setSecretVisible(false); return; }
        const value = await loadSecret();
        if (value) setSecretVisible(true);
      };
      const copyAppId = async () => {
        if (await copyText(account.appId)) markCopied("appId");
      };
      const copySecret = async () => {
        const value = secretValue || await loadSecret();
        if (value && await copyText(value)) markCopied("secret");
      };
      useEffect(() => {
        checkRequest.current += 1;
        checkPending.current = false;
        setCheckResult(null);
        setCheckFailed(false);
        setChecking(false);
        setCheckOpen(true);
        return () => { checkRequest.current += 1; };
      }, [account.id]);
      const check = async () => {
        if (checkPending.current) return;
        checkPending.current = true;
        const request = ++checkRequest.current;
        setChecking(true);
        setCheckResult(null);
        setCheckFailed(false);
        try {
          const result = await onAction(account.id, "check");
          if (request === checkRequest.current) {
            if (result && result.account && result.diagnostics?.version === 1 && Array.isArray(result.diagnostics.checks) && result.diagnostics.checks.length) {
              setCheckResult({ ...result.account, diagnostics: result.diagnostics });
              setCheckOpen(true);
            }
            else if (result && result.account) setCheckFailed("connection.restartRequired");
            else setCheckFailed(true);
          }
        } catch {
          if (request === checkRequest.current) setCheckFailed(true);
        } finally {
          if (request === checkRequest.current) { checkPending.current = false; setChecking(false); }
        }
      };
      const saveSeq = useRef(0);
      useEffect(() => {
        saveSeq.current += 1;
        setDraft(account);
        setNote("");
      }, [account.id, account.cwd, account.permission, account.agentPreset, account.privateAccess, account.sendMode, JSON.stringify(account.commandPermissions), account.receiveEnabled, account.assistant && account.assistant.provider, account.assistant && account.assistant.model, account.assistant && account.assistant.reasoningEffort]);
      const save = (patch) => {
        const seq = ++saveSeq.current;
        const next = { ...draft, ...patch };
        setDraft(next);
        setNote("status.saving");
        const payload = {
          name: next.name,
          cwd: next.cwd,
          provider: next.assistant.provider,
          model: next.assistant.model,
          reasoningEffort: next.assistant.reasoningEffort || null,
          permission: next.permission,
          privateAccess: next.privateAccess,
          sendMode: next.sendMode,
          agentPreset: next.agentPreset,
          commandPermissions: next.commandPermissions,
        };
        return onSave(account.id, payload).then((ok) => {
          if (seq === saveSeq.current) setNote(ok ? "status.saved" : "error.save");
          return ok;
        });
      };
      const applySettings = (patch) => {
        const hasAssistant = Object.prototype.hasOwnProperty.call(patch, "provider") || Object.prototype.hasOwnProperty.call(patch, "model") || Object.prototype.hasOwnProperty.call(patch, "reasoningEffort");
        if (!hasAssistant) return save(patch);
        const assistant = {
          ...(draft.assistant || {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "provider") ? { provider: patch.provider } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "model") ? { model: patch.model } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, "reasoningEffort") ? { reasoningEffort: patch.reasoningEffort || undefined } : {}),
        };
        return save({ assistant });
      };
      return h("div", { className: "dfc-inspector" },
        modalHolder,
        h("div", { className: "dfc-inspector-head" },
          h(Logo, { id: account.platform }),
          h("div", { className: "dfc-inspector-head-copy" },
            h("div", { className: "dfc-inspector-title-row" },
            h("h3", { className: "dfc-inspector-title" }, accountLabel(account, t)),
            h("div", { className: account.connectionState === "connected" ? "dfc-inspector-status ok" : "dfc-inspector-status" }, h(Tag, {
              color: account.receiveConfigured === false ? "warning" : account.connectionState === "connected" ? "success" : "warning",
              bordered: false,
            }, t(account.receiveConfigured === false ? "connection.paused" : "connection." + (account.connectionState || "unknown")))),
            ),
            h("div", { className: "dfc-account-id" }, account.id),
          ),
        ),
        h("div", { className: "dfc-form" },
          h("div", { className: "dfc-app-info" },
            h("div", { className: "dfc-app-info-title" }, t("app.info")),
            h("div", { className: "dfc-app-fields" },
              h("label", { className: "dfc-picker-field" },
                h("span", { className: "dfc-picker-label" }, t("app.id")),
                h("div", { className: "dfc-copy-row" },
                  h(Input, { type: "text", value: account.appId || "", readOnly: true, placeholder: t("app.notSaved") }),
                  h(Button, { size: "sm", variant: "outline", disabled: !account.appId, onClick: copyAppId }, t(copied === "appId" ? "app.copied" : "app.copy")),
                ),
              ),
              h("label", { className: "dfc-picker-field" },
                h("span", { className: "dfc-picker-label" }, t("app.secret")),
                h("div", { className: "dfc-copy-row" },
                  h(Input, {
                    type: secretVisible ? "text" : "password",
                    value: secretVisible ? secretValue : (account.hasAppSecret ? "••••••••" : ""),
                    readOnly: true,
                    placeholder: t("app.notSaved"),
                  }),
                  h(Button, { size: "sm", variant: "outline", disabled: secretBusy || !account.hasAppSecret, onClick: revealSecret }, t(secretVisible ? "app.hide" : "app.reveal")),
                  h(Button, { size: "sm", variant: "outline", disabled: secretBusy || !account.hasAppSecret, onClick: copySecret }, t(copied === "secret" ? "app.copied" : "app.copy")),
                ),
              ),
            ),
          ),
          h("div", { className: "dfc-picker-field" },
            h("span", { className: "dfc-picker-label" }, t("account.remark")),
            h(AccountRemarkEditor, { account, t, always: true, disabled: Boolean(busy), onSave: (name) => save({ name }) }),
            h("div", { className: "dfc-picker-note" }, t("account.remarkNote")),
          ),
          h(AccountSettingsPicker, {
            value: draft,
            onChange: applySettings,
            catalog,
            permissions,
            agentPresets,
            workspaces,
            createWorkspace,
            pickDirectory,
            modelT,
            permissionT,
            presetT,
            workspaceLabel: t("account.currentWorkspace"),
            t,
          }),
          h(CommandPermissionSettings, { value: draft.commandPermissions, onSave: commandPermissions => save({ commandPermissions }), t }),
          note && h("div", { className: note === "status.saved" ? "dfc-save-note ok" : "dfc-save-note" }, t(note)),
          h("div", { className: "dfc-inspector-actions" },
            h(Button, { variant: "outline", disabled: Boolean(busy) || checking, onClick: check }, t(checking ? "connection.checking" : "action.checkConnection")),
            h(Button, { variant: "outline", disabled: Boolean(busy) || checking, onClick: () => { setCheckResult(null); return onAction(account.id, "reconnect"); } }, t("action.reconnectAccount")),
            h(Button, { variant: "outline", danger: true, disabled: Boolean(busy) || checking, onClick: () => {
              modal.confirm({
                title: t("action.removeAccount"),
                description: t("account.removeConfirm"),
                okText: t("action.removeAccount"),
                cancelText: t("action.cancel"),
                okButtonProps: { danger: true },
                onOk: () => onAction(account.id, "remove"),
              });
            } }, t("action.removeAccount")),
          ),
          checkResult && h("div", { className: "dfc-check-section" },
            h("div", { className: "dfc-check-head" },
              h("span", { className: "dfc-check-title" }, t("connection.diagnostics")),
              h(Button, {
                size: "sm",
                variant: "ghost",
                className: "dfc-check-toggle",
                icon: h(checkOpen ? IconChevronDownOutline : IconChevronRightOutline, { size: 13 }),
                onClick: () => setCheckOpen((open) => !open),
              }, t(checkOpen ? "action.collapse" : "action.expand")),
            ),
            checkOpen && h(AccountConnectionCheck, { account: checkResult, t }),
          ),
          checkFailed && h(NoticeBar, { type: "error", role: "alert" }, t(typeof checkFailed === "string" ? checkFailed : "connection.checkFailed")),
        ),
      );
    }

    function AccountRemarkEditor(props) {
      const account = props.account;
      const t = props.t;
      const display = accountLabel(account, t);
      const stored = account.autoName ? "" : (account.name || "");
      const [draft, setDraft] = useState(stored);
      const [editing, setEditing] = useState(Boolean(props.always));
      const skipCommit = useRef(false);
      useEffect(() => {
        setDraft(account.autoName ? "" : (account.name || ""));
        if (!props.always) setEditing(false);
      }, [account.id, account.name, account.autoName, props.always]);
      const commit = () => {
        if (skipCommit.current) {
          skipCommit.current = false;
          return;
        }
        const next = draft.trim();
        const current = account.autoName ? "" : (account.name || "");
        if (next === current) {
          if (!props.always) setEditing(false);
          return;
        }
        Promise.resolve(props.onSave(next)).then((ok) => {
          if (!ok) setDraft(current);
          if (!props.always) setEditing(false);
        });
      };
      if (!props.always && !editing) {
        return h("button", {
          type: "button",
          className: "dfc-account-name dfc-account-rename-button",
          title: t("account.rename"),
          "aria-label": display + " · " + t("account.rename"),
          disabled: Boolean(props.disabled),
          onClick: (event) => { event.stopPropagation(); setEditing(true); },
        }, display);
      }
      return h("input", {
        type: "text",
        className: props.always ? "dfc-account-remark-input" : "dfc-account-rename",
        autoFocus: !props.always,
        maxLength: 40,
        value: draft,
        placeholder: display,
        "aria-label": t("account.remark"),
        disabled: Boolean(props.disabled),
        onClick: (event) => event.stopPropagation(),
        onMouseDown: (event) => event.stopPropagation(),
        onChange: (event) => setDraft(event.target.value),
        onBlur: commit,
        onKeyDown: (event) => {
          if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === "Escape" && !props.always) {
            event.preventDefault();
            event.stopPropagation();
            skipCommit.current = true;
            setDraft(stored);
            setEditing(false);
          }
        },
      });
    }

    function FeishuRemoteModelSelect({ sessionId, t }) {
      const accountId = accountIdOfSession(sessionId);
      const [accounts, setAccounts] = useState([]);
      useEffect(() => channelRefresh.subscribe((data) => {
        if (!data || !data.ok) return;
        setAccounts((data.channels || []).flatMap((channel) => channel.accounts || []));
      }), []);
      if (!accountId) return h("span", { className: "dfc-remote-model-missing" }, t("composer.modelUnavailable"));
      const account = accounts.find((item) => item.id === accountId);
      if (!account) return h("span", { className: "dfc-remote-model-missing" }, t("composer.modelLoading"));
      const assistant = account.assistant || {};
      const label = assistant.provider && assistant.model
        ? String(assistant.provider) + " / " + String(assistant.model)
        : "";
      if (!label) return h("span", { className: "dfc-remote-model-missing" }, t("composer.modelUnavailable"));
      return h("div", { className: "dfc-remote-model", title: t("composer.modelReadOnly") },
        h("span", { className: "dfc-remote-model-label" }, t("composer.model")),
        h("span", { className: "dfc-remote-model-value" }, label),
      );
    }

    function FeishuComposerGuard(props) {
      const t = props.t || fallbackT;
      return h("div", { className: "dfc-remote-composer", "data-dfc-composer-guard": "1", role: "group", "aria-label": t("composer.remoteTitle") },
        h("div", { className: "dfc-remote-composer-card" },
          h("div", { className: "dfc-remote-composer-icon", "aria-hidden": "true" }, h(BrandMark, { id: "feishu", compact: true, mono: true })),
          h("div", { className: "dfc-remote-composer-copy" },
            h("div", { className: "dfc-remote-composer-title" }, t("composer.remoteTitle")),
            h("div", { className: "dfc-remote-composer-hint" }, t("composer.remoteHint")),
          ),
          h(FeishuRemoteModelSelect, { sessionId: props.sessionId, t }),
        ),
      );
    }

    function FeishuChannelPage(props) {
      const t = props.t || fallbackT;
      const hostProps = props.hostProps || {};
      const ctx = props.ctx;
      const [data, setData] = useState(null);
      const [catalog, setCatalog] = useState({ providers: [], permissions: [], agentPresets: [], agentPreset: "standard", assistant: null, cwd: "", permission: "" });
      const [error, setError] = useState("");
      const [loading, setLoading] = useState(true);
      const [adding, setAdding] = useState(false);
      const [selectedId, setSelectedId] = useState("");
      const [busy, setBusy] = useState({});
      const refresh = useCallback(() => channelRefresh.invalidate().catch(() => undefined), []);
      useEffect(() => channelRefresh.subscribe((next, failure) => {
        if (failure) {
          setError(t("error.connection"));
          setLoading(false);
          return;
        }
        if (next && next.ok) {
          setData(next);
          setError("");
          setLoading(false);
        } else {
          setError(serverText(next && next.error, t) || t("error.load"));
          setLoading(false);
        }
      }), []);
      useEffect(() => {
        api("/assistant").then((next) => {
          if (!next.ok) return;
          setCatalog({
            providers: next.providers || [],
            permissions: next.permissions || [],
            agentPresets: next.agentPresets || [],
            agentPreset: next.agentPreset || "standard",
            assistant: next.assistant || null,
            cwd: next.cwd || "",
            permission: next.permission || "",
          });
        }).catch(() => undefined);
      }, []);
      const useWorkspacesHook = typeof hostProps.useWorkspaces === "function" ? hostProps.useWorkspaces : null;
      const workspaces = useWorkspacesHook
        ? (useWorkspacesHook((state) => (state && state.items) || []) || [])
        : [];
      const useSessionsHook = typeof hostProps.useSessions === "function" ? hostProps.useSessions : null;
      const hostCurrentSessionId = useSessionsHook
        ? (useSessionsHook((state) => currentSessionId(state)) || "")
        : "";
      const activeSessionId = typeof props.currentSessionId === "string" && props.currentSessionId
        ? props.currentSessionId
        : hostCurrentSessionId;
      const createWorkspace = (input) => (ctx && ctx.workspaces && typeof ctx.workspaces.create === "function"
        ? ctx.workspaces.create(input)
        : Promise.reject(new Error("workspace unavailable")));
      const pickDirectory = () => pickHostDirectory(ctx);
      const readMainSessionModelValue = () => readMainSessionModel(ctx);
      const channels = (data && data.channels) || [];
      const ch = channels.find((item) => item.id === "feishu") || {
        id: "feishu",
        label: "飞书",
        description: "",
        kind: "qr-or-credentials",
        fields: [],
        accounts: [],
      };
      const accounts = Array.isArray(ch.accounts) ? ch.accounts : [];
      const groups = (data && data.groups) || [];
      const sessions = groups.flatMap((group) => (group && group.sessions) || []);
      const pending = (data && data.pending) || [];
      const selectedAccount = accounts.find((account) => account.id === selectedId) || null;
      const sessionsFor = (account) => sessions
        .filter((session) => String(session.channel || "") === account.id)
        .sort((a, b) => (Date.parse(b.updatedAt || "") || 0) - (Date.parse(a.updatedAt || "") || 0));
      const openSession = (sessionId) => {
        if (!sessionId) return;
        const hostOpen = hostProps.openSession || hostProps.open;
        if (typeof hostOpen === "function") {
          hostOpen(sessionId);
          return;
        }
        openHostSession(ctx, sessionId);
      };
      const onAction = (id, action, body) => {
        setBusy((prev) => ({ ...prev, [id]: true }));
        return api("/accounts/" + id + "/" + action, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body || {}),
        }).then((result) => {
          if (!result.ok) {
            setError(serverText(result.error, t) || t("error.action"));
            return false;
          }
          setError("");
          if (action === "remove" && selectedId === id) setSelectedId("");
          refresh();
          return action === "check" ? result : true;
        }).catch(() => {
          setError(t("error.request"));
          return false;
        }).finally(() => setBusy((prev) => ({ ...prev, [id]: false })));
      };
      const saveAccount = (id, body) => onAction(id, "settings", body);
      const toggleReceive = (account) => onAction(account.id, "receive", { receiveEnabled: !account.receiveConfigured });
      const approve = (item, allow) => onAction(item.channelId, allow ? "approve" : "deny", { userId: item.userId });

      return h("section", { className: "dfc-channel-page", "aria-label": t("settings.label") },
        h("div", { className: "dfc-channel-head" },
          h(Button, {
            variant: "ghost",
            size: "sm",
            className: "dfc-channel-add",
            icon: h(IconPlusOutline, { size: 13 }),
            disabled: !data,
            onClick: () => setAdding(true),
          }, t("action.addAccount")),
        ),
        error && h(NoticeBar, { type: "error", role: "alert" }, error),
        pending.length > 0 && h("div", { className: "dfc-channel-pending", role: "region" },
          h("div", { className: "dfc-channel-pending-title" }, t("pending.notice")),
          ...pending.map((item) => h("div", { key: item.channelId + item.userId, className: "dfc-channel-pending-row" },
            h("span", { className: "dfc-channel-pending-user" }, (item.username || item.userId) + " · " + (accountLabel(accounts.find((account) => account.id === item.channelId), t) || item.channelId)),
            h(Button, { size: "sm", variant: "primary", onClick: () => approve(item, true) }, t("action.approve")),
            h(Button, { size: "sm", variant: "outline", danger: true, onClick: () => approve(item, false) }, t("action.deny")),
          )),
        ),
        loading && !data
          ? h("div", { className: "dfc-channel-empty" }, t("loading"))
          : accounts.length === 0
            ? h("div", { className: "dfc-channel-empty" }, t("channel.empty"))
            : h("div", { className: "dfc-channel-accounts" },
                ...accounts.map((account) => {
                  const accountSessions = sessionsFor(account);
                  const accountStatus = account.receiveConfigured === false ? "paused" : (account.connectionState || "unknown");
                  return h("div", { key: account.id, className: "dfc-channel-account" },
                    h("div", { className: "dfc-channel-account-head" },
                      h(Logo, { id: "feishu", small: true }),
                      h("div", { className: "dfc-channel-account-copy" },
                        h("div", { className: "dfc-channel-account-name" }, accountLabel(account, t) || account.name || account.id),
                      ),
                      h(Tag, {
                        color: account.receiveConfigured === false ? "warning" : account.connectionState === "connected" ? "success" : "warning",
                        bordered: false,
                      }, t("connection." + accountStatus)),
                      h("div", { className: "dfc-channel-account-actions" },
                        h(Button, {
                          size: "sm",
                          variant: "ghost",
                          className: "dfc-channel-settings",
                          icon: h(IconSettingsOutline16, { size: 14 }),
                          "aria-label": t("action.settings"),
                          title: t("action.settings"),
                          disabled: Boolean(busy[account.id]),
                          onClick: () => setSelectedId(account.id),
                        }),
                      ),
                    ),
                    accountSessions.length > 0
                      ? h("div", { className: "dfc-channel-sessions" },
                          ...accountSessions.map((session) => {
                            const current = Boolean(activeSessionId) && String(session.sessionId) === String(activeSessionId);
                            return h("button", {
                              key: session.sessionId,
                              type: "button",
                              className: "dfc-channel-session" + (current ? " is-current" : ""),
                              title: session.title || t("session.untitled"),
                              "aria-current": current ? "true" : undefined,
                              onClick: () => openSession(session.sessionId),
                            },
                              h("span", { className: "dfc-channel-session-title" }, session.title || t("session.untitled")),
                              h("span", { className: "dfc-channel-session-time" }, relativeTime(session.updatedAt, t)),
                            );
                          }),
                        )
                      : h("div", { className: "dfc-channel-account-empty" }, t("account.noSessions")),
                  );
                }),
              ),
        adding && h(BindModal, {
          ch,
          catalog: catalog.providers,
          permissions: catalog.permissions,
          agentPresets: catalog.agentPresets,
          workspaces,
          createWorkspace,
          pickDirectory,
          modelT: props.modelT,
          permissionT: props.permissionT,
          presetT: props.presetT,
          defaults: catalog,
          readMainSessionModel: readMainSessionModelValue,
          onClose: () => setAdding(false),
          onConnected: () => { setAdding(false); refresh(); },
          t,
        }),
        selectedAccount && h(Modal, {
          open: true,
          className: "dfc-account-modal",
          title: t("action.settings"),
          width: 760,
          zIndex: 1100,
          layerOwner: "feishu-account",
          destroyOnHidden: true,
          onCancel: () => setSelectedId(""),
          footer: null,
        }, h(AccountInspector, {
          account: selectedAccount,
          busy: Boolean(busy[selectedAccount.id]),
          catalog: catalog.providers,
          permissions: catalog.permissions,
          agentPresets: catalog.agentPresets,
          workspaces,
          createWorkspace,
          pickDirectory,
          modelT: props.modelT,
          permissionT: props.permissionT,
          presetT: props.presetT,
          t,
          onAction,
          onSave: saveAccount,
        })),
      );
    }

    function SettingsPage(props) {
      const t = props.t || fallbackT;
      const [channels, setChannels] = useState(null);
      const [pending, setPending] = useState([]);
      const [error, setError] = useState("");
      const [busy, setBusy] = useState({});
      const [editing, setEditing] = useState(null);
      const [selected, setSelected] = useState(storedAccountSelection);
      const [settingsAccount, setSettingsAccount] = useState(null);
      const [expanded, setExpanded] = useState({});
      const [channelSettingsRequest, setChannelSettingsRequest] = useState(() => typeof window !== "undefined" ? readChannelSettingsRequest(window.sessionStorage) : undefined);
      const [catalog, setCatalog] = useState({ providers: [], permissions: [], assistant: null, cwd: "", permission: "" });
      const workspaces = props.useWorkspaces ? (props.useWorkspaces((state) => state && state.items || []) || []) : [];
      const selectAccount = useCallback((id) => {
        const next = id || "";
        setSelected(next);
        rememberAccountSelection(next);
      }, []);

      const refresh = useCallback(() => {
        return channelRefresh.invalidate().catch(() => undefined);
      }, []);

      useEffect(() => channelRefresh.subscribe((data, error) => {
        if (error) { setError(t("error.connection")); return; }
        if (data.ok) {
          setChannels(data.channels);
          setPending(data.pending || []);
          setError("");
          const all = (data.channels || []).flatMap((channel) => channel.accounts || []);
          setSelected((current) => {
            const next = all.some((item) => item.id === current) ? current : "";
            if (next !== current) rememberAccountSelection(next);
            return next;
          });
        } else setError(serverText(data.error, t) || t("error.load"));
      }), []);

      useEffect(() => {
        ensureStyle();
        api("/assistant").then((data) => {
          if (data.ok) setCatalog({ providers: data.providers || [], permissions: data.permissions || [], agentPresets: data.agentPresets || [], agentPreset: data.agentPreset || "standard", assistant: data.assistant || null, cwd: data.cwd || "", permission: data.permission || "" });
        }).catch(() => undefined);
      }, [refresh]);
      useEffect(() => {
        if (!settingsAccount) return undefined;
        const onKey = (event) => {
          if (modalLayers.length && modalLayers[modalLayers.length - 1].owner !== "settings-account") return;
          if (event.key !== "Escape") return;
          if (document.querySelector("[role='listbox'], [role='menu'], .dfc-menu-select-dropdown")) return;
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
          setSettingsAccount(null);
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
      }, [settingsAccount]);
      useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const onRequest = (event) => {
          const request = parseChannelSettingsRequest(event.detail);
          if (request) setChannelSettingsRequest(request);
        };
        window.addEventListener(CHANNEL_SETTINGS_EVENT, onRequest);
        return () => window.removeEventListener(CHANNEL_SETTINGS_EVENT, onRequest);
      }, []);
      useEffect(() => {
        if (!channelSettingsRequest || channels == null) return;
        const target = resolveChannelSettingsTarget(channelSettingsRequest, channels);
        clearChannelSettingsRequest(typeof window !== "undefined" ? window.sessionStorage : undefined);
        setChannelSettingsRequest(undefined);
        if (!target) return;
        setExpanded((current) => Object.assign({}, current, { [target.channelId]: true }));
        if (target.accountId) {
          selectAccount(target.accountId);
          setSettingsAccount(target.accountId);
        }
        if (typeof document !== "undefined") {
          const node = document.querySelector('[data-dfc-platform="' + target.channelId + '"]');
          if (node && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
        }
      }, [channelSettingsRequest, channels, selectAccount]);

      const onAction = (id, action, body) => {
        const removalFallback = action === "remove"
          ? (() => {
              const owner = (channels || []).find((channel) => (channel.accounts || []).some((account) => account.id === id));
              const ownerAccounts = owner && owner.accounts || [];
              const removedIndex = ownerAccounts.findIndex((account) => account.id === id);
              const adjacent = ownerAccounts[removedIndex + 1] || ownerAccounts[removedIndex - 1];
              if (adjacent) return adjacent.id;
              return (channels || []).flatMap((channel) => channel.accounts || []).find((account) => account.id !== id)?.id || "";
            })()
          : "";
        setBusy((prev) => ({ ...prev, [id]: true }));
        return api("/accounts/" + id + "/" + action, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body || {}),
        }).then((data) => {
          if (!data.ok) { setError(serverText(data.error, t) || t("error.action")); return false; }
          setError("");
          if (action === "remove" && selected === id) selectAccount(removalFallback);
          refresh();
          return action === "check" ? data : true;
        }).catch(() => { setError(t("error.request")); return false; }).finally(() => setBusy((prev) => ({ ...prev, [id]: false })));
      };
      const saveAccount = (id, body) => onAction(id, "settings", body);
      const allAccounts = (channels || []).flatMap((channel) => channel.accounts || []);
      const selectedAccount = allAccounts.find((item) => item.id === settingsAccount);

      return h("section", { className: "dfc-page dfc-account-page", "aria-label": t("settings.aria") },
        h("header", { className: "dfc-head" },
          h("div", { className: "dfc-heading" },
            h("div", { className: "dfc-title-row" },
              h("h2", { className: "dfc-title" }, t("settings.title")),
            ),
            h("p", { className: "dfc-sub" }, t("settings.description")),
          ),
        ),
        error && h(NoticeBar, { type: "error", className: "dfc-error" }, error),
        pending.length > 0 && h("div", { className: "dfc-feedback dfc-feedback-warning dfc-pending", role: "region" },
          h("div", { className: "dfc-feedback-head" },
            h("span", { className: "dfc-feedback-icon" }, alertIcon("warning")),
            h("span", { className: "dfc-feedback-title" }, t("pending.notice")),
          ),
          h("div", { className: "dfc-pending-list" },
            ...pending.map((p) => h("div", { key: p.channelId + p.userId, className: "dfc-pending-row" },
              h("span", { style: { flex: 1 } }, (p.username || p.userId) + " · " + (accountLabel(allAccounts.find((item) => item.id === p.channelId), t) || p.channelId)),
              h(Button, { variant: "primary", size: "sm", onClick: () => onAction(p.channelId, "approve", { userId: p.userId }) }, t("action.approve")),
              h(Button, { variant: "outline", size: "sm", danger: true, onClick: () => onAction(p.channelId, "deny", { userId: p.userId }) }, t("action.deny")),
            )),
          ),
        ),
        channels == null
          ? h("div", { className: "dfc-empty" }, t("loading"))
          : h("div", { className: "dfc-account-shell" },
              h("div", { className: "dfc-platforms" },
                ...channels.map((ch) => {
                  const canExpand = (ch.accounts || []).length > 0;
                  const open = canExpand && Boolean(expanded[ch.id]);
                  const toggleExpanded = canExpand ? () => setExpanded({ ...expanded, [ch.id]: !open }) : undefined;
                  return h("div", { key: ch.id, className: "dfc-platform" + (open ? " open" : "") + (canExpand ? "" : " empty"), "data-dfc-platform": ch.id },
                    h("div", { className: "dfc-platform-head", role: canExpand ? "button" : undefined, tabIndex: canExpand ? 0 : undefined, "aria-expanded": canExpand ? open : undefined, onClick: toggleExpanded, onKeyDown: canExpand ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpanded(); } } : undefined },
                      h(Logo, { id: ch.id }),
                      h("span", { className: "dfc-platform-title" }, channelLabel(ch, t)),
                      h("div", { className: "dfc-platform-meta" },
                        h("span", { className: "dfc-platform-count" }, t("account.count", { count: ch.total })),
                        h(Button, { onClick: (e) => { e.stopPropagation(); setEditing(ch.id); } }, t("action.addAccount")),
                        h("span", { className: canExpand ? "dfc-platform-caret" : "dfc-platform-caret empty", "aria-hidden": "true" }, canExpand && h(IconChevron)),
                      ),
                    ),
                    open && h("div", { className: "dfc-account-list" },
                      ...(ch.accounts || []).map((account) => h("div", { key: account.id, className: "dfc-account-row" },
                        h("span", { className: "dfc-account-copy" }, h(AccountRemarkEditor, { account, t, disabled: Boolean(busy[account.id]), onSave: (name) => onAction(account.id, "settings", { name }) })),
                        h(Tag, {
                          color: busy[account.id] ? "processing" : account.receiveConfigured === false ? "warning" : account.connectionState === "connected" ? "success" : "warning",
                          bordered: false,
                          className: "dfc-account-status-tag" + (busy[account.id] ? " is-busy" : ""),
                          icon: busy[account.id] ? createSpinner() : undefined,
                        }, busy[account.id] ? t("account.statusProcessing") : t(account.receiveConfigured === false ? "connection.paused" : "connection." + (account.connectionState || "unknown"))),
                        h("div", { className: "dfc-account-receive", title: t("account.receiveDescription") },
                          h("span", null, t("account.receive")),
                          h(Switch, { role: "switch", checked: account.receiveConfigured === true, "aria-checked": Boolean(account.receiveConfigured === true), "aria-label": accountLabel(account, t) + " · " + t("account.receive"), title: account.receiveConfigured === undefined ? t("connection.receiveUnknown") : t("account.receive"), disabled: Boolean(busy[account.id]) || account.receiveConfigured === undefined, onChange: (checked) => onAction(account.id, "receive", { receiveEnabled: checked }) })),
                        h(Button, { onClick: () => { selectAccount(account.id); setSettingsAccount(account.id); } }, t("action.settings")),
                      )),
                    ),
                  );
                }),
              ),
            ),
        selectedAccount && h(Modal, {
          open: true,
          className: "dfc-account-modal",
          title: t("action.settings"),
          width: 720,
          zIndex: 1100,
          layerOwner: "settings-account",
          destroyOnHidden: true,
          onCancel: () => setSettingsAccount(null),
          footer: null,
        },
          h(AccountInspector, {
                    account: selectedAccount,
                    busy: busy[selectedAccount.id],
                    catalog: catalog.providers,
                    permissions: catalog.permissions,
                    agentPresets: catalog.agentPresets,
                    workspaces,
                    createWorkspace: props.createWorkspace,
                    pickDirectory: props.pickDirectory,
                    modelT: props.modelT,
                    permissionT: props.permissionT,
                    presetT: props.presetT,
                    t,
                    onAction,
                    onSave: saveAccount,
            }),
        ),
        editing && h(BindModal, {
          ch: (channels || []).find((item) => item.id === editing) || { id: editing, label: editing, kind: "qr", fields: [] },
          catalog: catalog.providers,
          permissions: catalog.permissions,
                    agentPresets: catalog.agentPresets,
          workspaces,
          createWorkspace: props.createWorkspace,
          pickDirectory: props.pickDirectory,
          modelT: props.modelT,
          permissionT: props.permissionT,
          presetT: props.presetT,
          defaults: catalog,
          readMainSessionModel: props.readMainSessionModel,
          onClose: () => setEditing(null),
          onConnected: () => { setEditing(null); setExpanded((prev) => ({ ...prev, [editing]: true })); refresh(); },
          t,
        }),
      );
    }

    function IconChevron() {
      return h(IconChevronRightOutline, { size: 14 });
    }

    // ---------------------------------------------------------------------
    // 频道页签：直接复用官方 WorkspaceBrowser。
    // 自绘列表已删除；官方树不可用时只显示不可用提示。
    // ---------------------------------------------------------------------

    const CHANNEL_WORKSPACE_PREFIX = "dsh-feishu-channels:";
    const CHANNEL_GROUP_IDS = ["feishu"];
    const EMPTY_SESSION_STATE = { ids: [], byId: {}, current: null };
    const EMPTY_WORKSPACE_STATE = { items: [], archivedSessionIds: [], pinnedSessionIds: [], state: "idle", phase: "ready", error: null };
    const CHANNEL_GROUP_OPTION_ATTR = "data-dfc-channel-group-option";
    const CHANNEL_GROUP_MENU_ATTR = "data-dfc-channel-group-menu";

    function channelWorkspaceId(id) {
      return CHANNEL_WORKSPACE_PREFIX + String(id || "");
    }

    function channelIdFromWorkspaceId(workspaceId) {
      const value = String(workspaceId || "");
      return value.startsWith(CHANNEL_WORKSPACE_PREFIX) ? value.slice(CHANNEL_WORKSPACE_PREFIX.length) : undefined;
    }

    /** 频道页签把官方“添加工作区”按钮复用为“添加频道”。 */
    function channelAddFlow(select) {
      return select(true);
    }

    function noopChannelAction() {}

    function copySessionOrders(orders) {
      return Object.fromEntries(Object.entries(orders || {}).map(([key, order]) => [key, [...order]]));
    }

    /** 频道页签使用独立视图状态，不污染上方任务树。 */
    function createChannelViewStore() {
      let state = {
        groupBy: "channel",
        orderBy: "updated",
        groupExpansion: {},
        sessionOrderByAccount: {},
        archivedFilter: "default",
      };
      const listeners = new Set();
      const publish = (next) => {
        state = next;
        for (const listener of listeners) listener();
      };
      const actions = {
        setGroupBy(mode) {
          if (mode !== state.groupBy) publish(Object.assign({}, state, { groupBy: mode }));
        },
        setOrderBy(mode, initialOrders) {
          if (mode === state.orderBy) return;
          publish(Object.assign({}, state, {
            orderBy: mode,
            sessionOrderByAccount: mode === "manual" ? copySessionOrders(initialOrders) : {},
          }));
        },
        setGroupExpanded(key, expanded) {
          if (state.groupExpansion[key] === expanded) return;
          publish(Object.assign({}, state, { groupExpansion: Object.assign({}, state.groupExpansion, { [key]: expanded }) }));
        },
        retainAccountKeys(workspaceKeys) {
          const retained = new Set(workspaceKeys || []);
          const groupExpansion = Object.fromEntries(Object.entries(state.groupExpansion).filter(([key]) => retained.has(key)));
          const sessionOrderByAccount = Object.fromEntries(Object.entries(state.sessionOrderByAccount).filter(([key]) => retained.has(key)));
          if (Object.keys(groupExpansion).length === Object.keys(state.groupExpansion).length
            && Object.keys(sessionOrderByAccount).length === Object.keys(state.sessionOrderByAccount).length) return;
          publish(Object.assign({}, state, { groupExpansion, sessionOrderByAccount }));
        },
        setSessionOrder(accountKey, order, initialOrders) {
          const sessionOrderByAccount = state.orderBy === "manual"
            ? Object.assign({}, state.sessionOrderByAccount, { [accountKey]: [...order] })
            : Object.assign(copySessionOrders(initialOrders), { [accountKey]: [...order] });
          publish(Object.assign({}, state, { orderBy: "manual", sessionOrderByAccount }));
        },
        syncSessionOrders(orders) {
          if (state.orderBy !== "manual") return;
          publish(Object.assign({}, state, { sessionOrderByAccount: Object.assign({}, state.sessionOrderByAccount, copySessionOrders(orders)) }));
        },
        pinSessionOrder(sessionId, accountKeys, source) {
          const selected = new Set(accountKeys || []);
          const sessionOrderByAccount = Object.fromEntries(Object.entries((source && source.members) || {}).map(([key, members]) => {
            const current = state.sessionOrderByAccount[key] || members;
            const order = selected.has(key) ? [sessionId, ...current.filter((id) => id !== sessionId)] : [...current];
            return [key, order];
          }));
          publish(Object.assign({}, state, { sessionOrderByAccount }));
        },
        setArchivedFilter(filter) {
          if (filter !== state.archivedFilter) publish(Object.assign({}, state, { archivedFilter: filter }));
        },
        ensureExpanded(keys) {
          let changed = false;
          const groupExpansion = Object.assign({}, state.groupExpansion);
          for (const key of keys || []) {
            if (key === "" || groupExpansion[key] !== undefined) continue;
            groupExpansion[key] = true;
            changed = true;
          }
          if (changed) publish(Object.assign({}, state, { groupExpansion }));
        },
      };
      return {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        actions,
      };
    }

    let sharedChannelViewStore;
    function getChannelViewStore() {
      sharedChannelViewStore = sharedChannelViewStore || createChannelViewStore();
      return sharedChannelViewStore;
    }

    const channelSessionStateCache = new WeakMap();
    const channelSyntheticWorkspaceCache = new WeakMap();
    const channelRealWorkspaceCache = new WeakMap();

    /** 只保留 /channels 分组里的会话，避免官方树出现“未分组”桶。 */
    function channelMemberSessionState(state, memberIds) {
      const src = state || EMPTY_SESSION_STATE;
      const hit = channelSessionStateCache.get(src);
      if (hit && hit.ids === memberIds) return hit.result;
      const ids = (src.ids || []).filter((id) => memberIds.has(String(id)));
      const result = cacheFilteredSessions(src, ids);
      channelSessionStateCache.set(src, { ids: memberIds, result });
      return result;
    }

    function channelGroupsFromSessionState(state, t) {
      const groups = new Map(CHANNEL_GROUP_IDS.map((id) => [id, {
        id,
        label: channelLabel({ id }, t),
        sessions: [],
      }]));
      const src = state || EMPTY_SESSION_STATE;
      for (const id of src.ids || []) {
        const group = groups.get(channelIdOfSession(id));
        const session = src.byId && src.byId[id];
        if (group && session) group.sessions.push({ sessionId: id, updatedAt: session.updatedAt });
      }
      return [...groups.values()].filter((group) => group.sessions.length > 0);
    }

    function channelGroupCreatedAt(group) {
      let earliest = Infinity;
      for (const session of group.sessions || []) {
        const timestamp = Date.parse(session.updatedAt || "");
        if (Number.isFinite(timestamp) && timestamp < earliest) earliest = timestamp;
      }
      return new Date(Number.isFinite(earliest) ? earliest : 0).toISOString();
    }

    /**
     * 按频道分组：每个频道合成一个官方 WorkspaceView。
     * 保留宿主的 phase/state/归档集合，官方浏览器才能正常渲染。
     */
    function syntheticChannelWorkspaceState(state, groups, t) {
      const src = state || EMPTY_WORKSPACE_STATE;
      const key = groups.map((group) => [
        group.id,
        channelLabel(group, t),
        channelGroupCreatedAt(group),
        (group.sessions || []).map((session) => session.sessionId).join(","),
      ].join("\0")).join("\0\0");
      const hit = channelSyntheticWorkspaceCache.get(src);
      if (hit && hit.key === key) return hit.result;
      const items = groups.filter((group) => (group.sessions || []).length > 0).map((group) => {
        const workspaceId = channelWorkspaceId(group.id);
        return {
          workspaceId,
          id: workspaceId,
          title: channelLabel(group, t),
          path: "",
          sessionIds: (group.sessions || []).map((session) => session.sessionId),
          createdAt: channelGroupCreatedAt(group),
        };
      });
      const result = Object.assign({}, src, { items, phase: "ready" });
      channelSyntheticWorkspaceCache.set(src, { key, result });
      return result;
    }

    /** 按工作区/工作区树：保留真实工作区，只过滤出频道会话。 */
    function channelRealWorkspaceState(state, memberIds) {
      const src = state || EMPTY_WORKSPACE_STATE;
      const hit = channelRealWorkspaceCache.get(src);
      if (hit && hit.ids === memberIds) return hit.result;
      const items = (src.items || []).map((workspace) => {
        const sessionIds = (workspace.sessionIds || []).filter((id) => memberIds.has(String(id)));
        return sessionIds.length === (workspace.sessionIds || []).length
          ? workspace
          : Object.assign({}, workspace, { sessionIds });
      });
      const result = Object.assign({}, src, { items });
      channelRealWorkspaceCache.set(src, { ids: memberIds, result });
      return result;
    }

    let channelIconCssValue;

    /** 把 React 元素渲染成可直接注入官方 DOM 的 HTML。 */
    function channelMarkup(element) {
      if (typeof document === "undefined") return "";
      const hasCreateRoot = typeof ReactDOM.createRoot === "function";
      const createRoot = ReactDOM.createRoot || function createRootFallback(host) {
        return {
          render(node) { if (typeof ReactDOM.render === "function") ReactDOM.render(node, host); },
          unmount() { if (typeof ReactDOM.unmountComponentAtNode === "function") ReactDOM.unmountComponentAtNode(host); },
        };
      };
      try {
        const host = document.createElement("div");
        const root = createRoot(host);
        try {
          if (hasCreateRoot && typeof ReactDOM.flushSync === "function") ReactDOM.flushSync(() => root.render(element));
          else root.render(element);
          return host.innerHTML;
        } finally {
          try { root.unmount(); } catch { /* ignore */ }
        }
      } catch {
        return "";
      }
    }

    const channelLogoUrlCache = new Map();
    /** 频道品牌标 data URL，供分组头和会话行复用。 */
    function channelLogoUrl(id) {
      if (channelLogoUrlCache.has(id)) return channelLogoUrlCache.get(id);
      const markup = channelMarkup(h(BrandMark, { id, compact: true }));
      const url = markup ? `url("data:image/svg+xml,${encodeURIComponent(markup)}")` : "";
      channelLogoUrlCache.set(id, url);
      return url;
    }

    /** 频道分组头图标：用品牌标覆盖官方文件夹图标，并保持悬停时可见。 */
    function channelIconCss() {
      if (channelIconCssValue !== undefined) return channelIconCssValue;
      if (typeof document === "undefined") {
        channelIconCssValue = "";
        return channelIconCssValue;
      }
      channelIconCssValue = CHANNEL_GROUP_IDS.map((id) => {
        const logo = channelLogoUrl(id);
        if (!logo) return "";
        const row = `[data-row-key="workspace:${channelWorkspaceId(id)}"]`;
        return `.dfc-channel-official ${row}>span:first-child>svg{display:none!important}`
          + `.dfc-channel-official ${row}>span:first-child{display:inline-flex!important;background:${logo} center/contain no-repeat!important}`
          // 宿主在悬停时用 chevron 换掉文件夹；频道分组保持品牌图标可见。
          + `.dfc-channel-official ${row}:hover>span:first-child{display:inline-flex!important}`
          + `.dfc-channel-official ${row}:hover>span:nth-child(2){display:none!important}`;
      }).join("");
      return channelIconCssValue;
    }

    let channelWorkspaceIconCache = { key: "", css: "" };
    /**
     * 按工作区/工作区树分组时，如果某个工作区的频道会话都来自同一个频道，
     * 用频道品牌标替换文件夹。混合频道的工作区保持官方文件夹图标。
     */
    function channelWorkspaceIconCss(workspaces, memberIds) {
      const entries = [];
      for (const workspace of workspaces || []) {
        const workspaceId = workspace.workspaceId || workspace.id;
        if (!workspaceId) continue;
        const channels = new Set();
        for (const sessionId of workspace.sessionIds || []) {
          if (!memberIds.has(String(sessionId))) continue;
          const channelId = channelIdOfSession(sessionId);
          if (channelId) channels.add(channelId);
        }
        if (channels.size !== 1) continue;
        const channelId = [...channels][0];
        if (!channelLogoUrl(channelId)) continue;
        entries.push([workspaceId, channelId]);
      }
      const key = entries.map(([workspaceId, channelId]) => `${workspaceId}\0${channelId}`).join("\0\0");
      if (channelWorkspaceIconCache.key === key) return channelWorkspaceIconCache.css;
      const css = entries.map(([workspaceId, channelId]) => {
        const logo = channelLogoUrl(channelId);
        const row = `[data-row-key=${JSON.stringify("workspace:" + workspaceId)}]`;
        const scope = `.dfc-channel-official:not([data-mode="channel"])`;
        return `${scope} ${row}>span:first-child>svg{display:none!important}`
          + `${scope} ${row}>span:first-child{display:inline-flex!important;background:${logo} center/contain no-repeat!important}`
          + `${scope} ${row}:hover>span:first-child{display:inline-flex!important}`
          + `${scope} ${row}:hover>span:nth-child(2){display:none!important}`;
      }).join("");
      channelWorkspaceIconCache = { key, css };
      return css;
    }

    /**
     * 官方视图选项菜单没有扩展位，注入第四个分组项「按频道」。
     * 只在频道页签挂载期间生效。
     */
    function installChannelGroupOption(options) {
      if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
      let frame;
      const closeMenu = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      const inject = (menu) => {
        const text = menu.textContent || "";
        if (!options.groupLabel || !options.workspaceLabel
          || !text.includes(options.groupLabel) || !text.includes(options.workspaceLabel)) return;
        if (menu.querySelector(`[${CHANNEL_GROUP_OPTION_ATTR}="true"]`) !== null) return;
        const items = [...menu.querySelectorAll('button[role="menuitem"]')];
        const first = items[0];
        if (!first) return;
        const wrapper = first.parentElement;
        if (!wrapper) return;
        const clone = wrapper.cloneNode(true);
        const button = clone.querySelector('button[role="menuitem"]');
        if (!button) return;
        button.setAttribute(CHANNEL_GROUP_OPTION_ATTR, "true");
        button.removeAttribute("aria-disabled");
        button.removeAttribute("disabled");
        button.disabled = false;
        button.classList.remove("danger");
        for (const svg of button.querySelectorAll(":scope > svg")) svg.remove();
        const spans = button.querySelectorAll("span");
        if (spans[0] !== undefined) spans[0].innerHTML = channelMarkup(h(IconQueueOutline, { size: 16 }));
        if (spans[1] !== undefined) spans[1].textContent = options.label;
        else button.textContent = options.label;
        if (options.checked) {
          const check = document.createElement("span");
          check.innerHTML = channelMarkup(h(IconCheckOutline, { size: 16 }));
          const svg = check.firstElementChild;
          if (svg !== null) {
            if (svg.style) svg.style.marginLeft = "auto";
            button.append(svg);
          }
        }
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
          window.setTimeout(options.onSelect, 0);
        });
        wrapper.parentElement?.insertBefore(clone, wrapper);
      };
      const scan = () => {
        frame = undefined;
        for (const menu of document.querySelectorAll('[role="menu"]')) inject(menu);
      };
      const schedule = () => {
        if (frame !== undefined) return;
        frame = window.requestAnimationFrame(scan);
      };
      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      schedule();
      return () => {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
        observer.disconnect();
        for (const item of document.querySelectorAll(`[${CHANNEL_GROUP_OPTION_ATTR}="true"]`)) item.parentElement?.remove();
      };
    }

    /**
     * 官方工作区分组菜单只有重命名/删除；频道组合成工作区需要「频道设置」，因此注入设置入口。
     */
    function installChannelGroupMenu(options) {
      if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
      let channelId;
      let rememberedAt = 0;
      let frame;
      const closeMenu = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      const remember = (event) => {
        const target = event.target && typeof event.target.closest === "function" ? event.target : undefined;
        if (target === undefined) return;
        const row = target.closest(`[data-row-key^="workspace:${CHANNEL_WORKSPACE_PREFIX}"]`);
        if (row !== null) {
          const key = row.getAttribute("data-row-key") || "";
          channelId = channelIdFromWorkspaceId(key.slice("workspace:".length));
          rememberedAt = performance.now();
          return;
        }
        if (target.closest('[role="menu"]') === null) channelId = undefined;
      };
      const hiddenItems = new Map();
      const hideOthers = (menu, ours) => {
        for (const item of menu.querySelectorAll('button[role="menuitem"]')) {
          if (ours.has(item)) continue;
          if (!hiddenItems.has(item)) {
            hiddenItems.set(item, {
              display: item.style.display,
              ariaHidden: item.getAttribute("aria-hidden"),
            });
          }
          item.style.display = "none";
          item.setAttribute("aria-hidden", "true");
        }
      };
      const inject = (menu) => {
        if (channelId === undefined || performance.now() - rememberedAt > 2000) return;
        if (menu.querySelector(`[${CHANNEL_GROUP_MENU_ATTR}="true"]`) !== null) return;
        const items = [...menu.querySelectorAll('button[role="menuitem"]')];
        if (items.length === 0) return;
        const menuText = items.map((item) => item.textContent || "").join(" ");
        if (!/(删除工作区|Delete workspace)/i.test(menuText)) return;
        const group = options.resolve(channelId);
        if (!group) return;
        const template = items.find((item) => /^(重命名|Rename)$/i.test((item.textContent || "").trim()))
          || items.find((item) => !item.disabled && !/danger|删除|Delete/i.test(item.textContent || ""))
          || items[0];
        const wrapper = template.parentElement;
        if (!wrapper) return;
        const build = (label, icon, onClick) => {
          const clone = wrapper.cloneNode(true);
          const button = clone.querySelector('button[role="menuitem"]');
          if (!button) return undefined;
          clone.removeAttribute(CHANNEL_GROUP_MENU_ATTR);
          button.removeAttribute(CHANNEL_GROUP_MENU_ATTR);
          button.removeAttribute("aria-disabled");
          button.removeAttribute("disabled");
          button.disabled = false;
          button.style.opacity = "";
          button.style.cursor = "";
          button.classList.remove("danger");
          button.setAttribute(CHANNEL_GROUP_MENU_ATTR, "true");
          const spans = button.querySelectorAll("span");
          if (spans[0] !== undefined) spans[0].innerHTML = icon;
          if (spans[1] !== undefined) spans[1].textContent = label;
          else button.textContent = label;
          let fired = false;
          const activate = (event) => {
            if (fired) return;
            fired = true;
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            closeMenu();
            // 等宿主菜单完成卸载后再打开设置，避免同一次点击被菜单的关闭逻辑吞掉。
            window.setTimeout(onClick, 50);
          };
          button.addEventListener("click", activate);
          button.addEventListener("pointerup", (event) => {
            if (event.button === 0) activate(event);
          });
          return clone;
        };
        const node = build(options.settingsLabel, channelMarkup(h(ChannelMenuSettingsIcon)), () => options.onSettings(group));
        if (node) wrapper.parentElement?.insertBefore(node, wrapper);
        const injected = new Set(menu.querySelectorAll(`[${CHANNEL_GROUP_MENU_ATTR}="true"]`));
        if (injected.size > 0) hideOthers(menu, injected);
      };
      const scan = () => {
        frame = undefined;
        for (const menu of document.querySelectorAll('[role="menu"]')) inject(menu);
      };
      const schedule = () => {
        if (frame !== undefined) return;
        frame = window.requestAnimationFrame(scan);
      };
      document.addEventListener("pointerdown", remember, true);
      document.addEventListener("click", remember, true);
      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      schedule();
      return () => {
        if (frame !== undefined) window.cancelAnimationFrame(frame);
        observer.disconnect();
        document.removeEventListener("pointerdown", remember, true);
        document.removeEventListener("click", remember, true);
        for (const [item, previous] of hiddenItems) {
          item.style.display = previous.display;
          if (previous.ariaHidden === null) item.removeAttribute("aria-hidden");
          else item.setAttribute("aria-hidden", previous.ariaHidden);
        }
        hiddenItems.clear();
        for (const item of document.querySelectorAll(`[${CHANNEL_GROUP_MENU_ATTR}="true"]`)) item.parentElement?.remove();
      };
    }

    function ChannelMenuSettingsIcon() {
      return h(IconSettingsOutline16, { size: 16 });
    }

    function ChannelUnavailable({ t }) {
      return h("div", { className: "dfc-channel-unavailable" }, t("rail.treeUnavailable"));
    }

    class ChannelTreeGuard extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error) {
        console.warn("[dsh-feishu-channels] 官方频道树渲染失败", error);
      }
      render() {
        return this.state.failed ? h(ChannelUnavailable, { t: this.props.t }) : this.props.children;
      }
    }

    function ChannelOfficialView(props) {
      const t = props.t || fallbackT;
      const hostProps = props.hostProps || {};
      const Official = props.officialTree;
      const hostT = typeof props.hostT === "function"
        ? props.hostT
        : (typeof hostProps.t === "function" ? hostProps.t : t);
      const rawUseSessions = hostProps.useSessions;
      const rawUseWorkspaces = hostProps.useWorkspaces;
      const store = getChannelViewStore();
      const membershipRevision = useSyncExternalStore(subscribeChannelMembership, channelMembershipSnapshot, channelMembershipSnapshot);
      const useChannelStore = useCallback((select) => {
        const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
        return select(snapshot);
      }, [store]);
      const groupBy = useChannelStore((state) => state.groupBy);
      const sessionSource = typeof rawUseSessions === "function"
        ? rawUseSessions((state) => state)
        : EMPTY_SESSION_STATE;
      // 宿主 0.2.x 首个权威快照前 phase 为 pending，列表失败时也停在 pending；
      // 旧宿主快照可能不带 phase，此时按已就绪处理，由 renderable 判定能力缺失。
      const groupsReady = sessionSource.phase === undefined || sessionSource.phase === "ready";
      const groupsError = sessionSource.state === "error";
      const groups = useMemo(() => channelGroupsFromSessionState(sessionSource, t), [membershipRevision, sessionSource, t]);
      const groupsRef = useRef(groups);
      groupsRef.current = groups;
      const [channelIcons, setChannelIcons] = useState("");
      const [workspaceIcons, setWorkspaceIcons] = useState("");
      const open = props.openSession || hostProps.open || hostProps.openSession;
      const openChannelSettings = props.openChannelSettings || hostProps.openChannelSettings;
      const openImSettings = props.openImSettings || hostProps.openImSettings || (() => openImSettingsPage(t));

      useEffect(() => { ensureStyle(); }, []);

      useEffect(() => {
        if (groupBy === "channel" && channelIcons === "") setChannelIcons(channelIconCss());
      }, [channelIcons, groupBy]);

      const memberKey = groups.map((group) => group.id + ":" + (group.sessions || []).map((session) => session.sessionId).join(",")).join("|");
      const memberIds = useMemo(() => {
        const ids = new Set();
        for (const group of groups) {
          for (const session of group.sessions || []) ids.add(String(session.sessionId));
        }
        return ids;
      }, [memberKey]);

      const useChannelSessions = useCallback((selector, equals) => {
        if (typeof rawUseSessions !== "function") return selector(EMPTY_SESSION_STATE);
        return rawUseSessions((state) => selector(channelMemberSessionState(state, memberIds)), equals);
      }, [memberIds, rawUseSessions]);

      const useChannelWorkspaces = useCallback((selector, equals) => {
        if (typeof rawUseWorkspaces !== "function") return selector(EMPTY_WORKSPACE_STATE);
        return rawUseWorkspaces((state) => selector(
          groupBy === "channel"
            ? syntheticChannelWorkspaceState(state, groups, t)
            : channelRealWorkspaceState(state, memberIds),
        ), equals);
      }, [groupBy, groups, memberIds, rawUseWorkspaces, t]);

      const workspaceSource = typeof rawUseWorkspaces === "function"
        ? rawUseWorkspaces((state) => state)
        : undefined;
      useEffect(() => {
        if (groupBy === "channel") {
          if (workspaceIcons !== "") setWorkspaceIcons("");
          return;
        }
        const items = (workspaceSource && workspaceSource.items) || [];
        const css = channelWorkspaceIconCss(items, memberIds);
        if (css !== workspaceIcons) setWorkspaceIcons(css);
      }, [groupBy, memberIds, membershipRevision, workspaceIcons, workspaceSource]);
      const groupKeys = useMemo(() => {
        if (groupBy === "channel") {
          return groups.filter((group) => (group.sessions || []).length > 0).map((group) => channelWorkspaceId(group.id));
        }
        if (groupBy === "flat") return [];
        return ((workspaceSource && workspaceSource.items) || [])
          .map((workspace) => String(workspace.workspaceId || workspace.id || ""))
          .filter((key) => key !== "");
      }, [groupBy, groups, workspaceSource]);
      useEffect(() => {
        store.actions.ensureExpanded(groupKeys);
      }, [groupKeys, store]);

      const text = useCallback((key, params) => {
        if (key === "section.workspaces" && groupBy === "channel") return t("rail.feishu");
        if (key === "workspace.add" || key === "menu.addWorkspace") return t("rail.addChannel");
        return hostT(key, params);
      }, [groupBy, hostT, t]);

      useEffect(() => installChannelGroupOption({
        label: t("rail.byChannel"),
        groupLabel: text("groupBy.label"),
        workspaceLabel: text("groupBy.workspace"),
        checked: groupBy === "channel",
        onSelect: () => store.actions.setGroupBy("channel"),
      }), [groupBy, store, t, text]);

      useEffect(() => installChannelGroupMenu({
        settingsLabel: t("rail.channelSettings"),
        resolve: (channelId) => groupsRef.current.find((group) => group.id === channelId),
        onSettings: (group) => {
          if (typeof openChannelSettings === "function") {
            openChannelSettings({ channelId: group.id, name: channelLabel(group, t) });
            return;
          }
          openImSettings();
        },
      }), [openChannelSettings, openImSettings, t]);

      const rawStartSession = hostProps.startSession;
      const rawRenameWorkspace = hostProps.renameWorkspace;
      const rawDeleteWorkspace = hostProps.deleteWorkspace;
      const rawInsertWorkspaceBefore = hostProps.insertWorkspaceBefore;
      const rawSearch = hostProps.searchSessions;
      const startChannelSession = useCallback((workspaceId, options) => {
        if (channelIdFromWorkspaceId(workspaceId) !== undefined) return;
        if (typeof rawStartSession === "function") rawStartSession(workspaceId, options);
      }, [rawStartSession]);
      const renameChannelWorkspace = useCallback(async (workspaceId, title) => {
        if (channelIdFromWorkspaceId(workspaceId) !== undefined) throw new Error(t("rail.groupReadOnly"));
        if (typeof rawRenameWorkspace === "function") await rawRenameWorkspace(workspaceId, title);
      }, [rawRenameWorkspace, t]);
      const deleteChannelWorkspace = useCallback(async (workspaceId) => {
        if (channelIdFromWorkspaceId(workspaceId) !== undefined) throw new Error(t("rail.groupReadOnly"));
        if (typeof rawDeleteWorkspace === "function") await rawDeleteWorkspace(workspaceId);
      }, [rawDeleteWorkspace, t]);
      const insertChannelWorkspaceBefore = useCallback(async (workspaceId, beforeWorkspaceId) => {
        if (channelIdFromWorkspaceId(workspaceId) !== undefined) return;
        if (typeof rawInsertWorkspaceBefore === "function") await rawInsertWorkspaceBefore(workspaceId, beforeWorkspaceId);
      }, [rawInsertWorkspaceBefore]);
      const searchChannelSessions = useCallback(async (query, signal) => {
        if (typeof rawSearch !== "function") return { items: [], hasMore: false };
        const result = await rawSearch(query, signal);
        return {
          items: (result.items || []).filter((item) => item && item.id !== undefined && memberIds.has(String(item.id))),
          hasMore: result.hasMore,
        };
      }, [memberIds, rawSearch]);
      const rawUseShortcuts = hostProps.useShortcuts;
      const useChannelShortcuts = useCallback((select, equals) => {
        if (typeof rawUseShortcuts !== "function") return select([]);
        return rawUseShortcuts((rows) => select((rows || []).filter((row) => row && row.id !== "workspace.add")), equals);
      }, [rawUseShortcuts]);

      const officialProps = Object.assign({}, hostProps, {
        t: text,
        useStore: useChannelStore,
        actions: store.actions,
        useSessions: useChannelSessions,
        useWorkspaces: useChannelWorkspaces,
        open: typeof open === "function" ? open : noopChannelAction,
        useDirectoryFlow: channelAddFlow,
        requestAddWorkspace: typeof openImSettings === "function" ? openImSettings : noopChannelAction,
        startSession: startChannelSession,
        renameWorkspace: renameChannelWorkspace,
        deleteWorkspace: deleteChannelWorkspace,
        insertWorkspaceBefore: insertChannelWorkspaceBefore,
      });
      if (typeof rawSearch === "function") officialProps.searchSessions = searchChannelSessions;
      if (typeof rawUseShortcuts === "function") officialProps.useShortcuts = useChannelShortcuts;

      const renderable = Official !== undefined && Official !== null
        && typeof rawUseSessions === "function" && typeof rawUseWorkspaces === "function";
      // 官方树会清理不存在的分组，首个权威快照到达前不能传入空列表。
      const body = !groupsReady ? null : renderable
        ? h(ChannelTreeGuard, { t }, h(Official, officialProps))
        : h(ChannelUnavailable, { t });

      return h(React.Fragment, null,
        h("div", { className: "dfc-channel-official", "data-mode": groupBy },
          groupBy === "channel" && channelIcons !== "" && h("style", null, channelIcons),
          groupBy !== "channel" && workspaceIcons !== "" && h("style", null, workspaceIcons),
          // 宿主列表失败时 phase 仍停在 pending，没有横幅就是整页空白。
          groupsError && h("div", { className: "dfc-channel-error", role: "alert" }, t("error.load")),
          body,
        ),
      );
    }

    const registryFilterCache = new WeakMap();
    function cacheFilteredSessions(src, ids) {
      if (ids.length === (src.ids || []).length) return src;
      const byId = {};
      for (const id of ids) {
        if (src.byId && src.byId[id]) byId[id] = src.byId[id];
      }
      return Object.assign({}, src, { ids, byId });
    }

    function openRegisteredSession(sessionId, registry, hostOpen) {
      const openers = registry && Array.isArray(registry.sessionOpeners) ? registry.sessionOpeners : [];
      const opener = openers
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .find((item) => item && typeof item.matchSession === "function" && item.matchSession(sessionId));
      if (!opener) {
        if (typeof hostOpen === "function") hostOpen(sessionId);
        return;
      }
      try {
        opener.open(sessionId, hostOpen);
      } catch {
        if (typeof hostOpen === "function") hostOpen(sessionId);
      }
    }

    function createNativeTabRegistry(officialTree) {
      const tabs = new Map();
      const sessionFilters = [];
      const sessionOpeners = [];
      const listeners = new Set();
      let cachedTabs = [];
      let revision = 0;
      const rebuild = () => { cachedTabs = [...tabs.values()].sort((a, b) => (a.order || 0) - (b.order || 0)); };
      const emit = () => {
        revision += 1;
        for (const listener of listeners) listener();
      };
      return {
        version: 1,
        officialTree,
        sessionFilters,
        sessionOpeners,
        getTabs() { return cachedTabs; },
        getRevision() { return revision; },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        insert(tab) {
          if (!tab || !tab.id) return () => {};
          tabs.set(tab.id, tab);
          rebuild();
          emit();
          return () => {
            // 同名页签可能已被其他注册替换，旧清理函数只能移除自己持有的项。
            if (tabs.get(tab.id) !== tab) return;
            tabs.delete(tab.id); rebuild(); emit();
          };
        },
        addSessionFilter(filter) {
          sessionFilters.push(filter);
          emit();
          return () => {
            const index = sessionFilters.indexOf(filter);
            if (index >= 0) sessionFilters.splice(index, 1);
            emit();
          };
        },
        addSessionOpener(opener) {
          sessionOpeners.push(opener);
          emit();
          return () => {
            const index = sessionOpeners.indexOf(opener);
            if (index >= 0) sessionOpeners.splice(index, 1);
            emit();
          };
        },
      };
    }

    function attachNativeTabRegistry(target, registry) {
      try { target.__dshNativeTabs = registry; } catch { /* ignore */ }
      return registry;
    }

    function findNativeTabRegistry(entry) {
      const target = entry && (typeof entry === "object" || typeof entry === "function") && "component" in entry ? entry.component : entry;
      const registry = target?.__dshNativeTabs;
      return registry?.version === 1 && typeof registry.getTabs === "function" && typeof registry.subscribe === "function" && typeof registry.insert === "function" ? registry : null;
    }

    function applySessionFilters(state, registry) {
      const src = state || { ids: [], byId: {}, current: null };
      const filters = registry && registry.sessionFilters ? registry.sessionFilters : [];
      if (!filters.length) return src;
      const revision = registry && typeof registry.getRevision === "function" ? registry.getRevision() : null;
      if (revision !== null && src && typeof src === "object") {
        const hit = registryFilterCache.get(src);
        if (hit && hit.registry === registry && hit.revision === revision) return hit.result;
      }
      const ids = (src.ids || []).filter((id) => filters.every((fn) => fn(String(id))));
      const result = cacheFilteredSessions(src, ids);
      if (revision !== null && src && typeof src === "object") registryFilterCache.set(src, { registry, revision, result });
      return result;
    }

    function SessionSwitcher(props) {
      const membershipRevision = useSyncExternalStore(subscribeChannelMembership, channelMembershipSnapshot, channelMembershipSnapshot);
      const t = props.t || fallbackT;
      const officialT = props.officialT || t;
      const Official = props.officialTree;
      const rawUseSessions = props.useSessions;
      const nativeTabs = props.nativeTabs;
      const extraTabs = useSyncExternalStore(
        (listener) => (nativeTabs && nativeTabs.subscribe ? nativeTabs.subscribe(listener) : () => {}),
        () => (nativeTabs && nativeTabs.getTabs ? nativeTabs.getTabs() : EMPTY_EXTRA_TABS),
        () => EMPTY_EXTRA_TABS,
      );
      const registryRevision = useSyncExternalStore(
        (listener) => (nativeTabs && nativeTabs.subscribe ? nativeTabs.subscribe(listener) : () => {}),
        () => (nativeTabs && nativeTabs.getRevision ? nativeTabs.getRevision() : 0),
        () => 0,
      );
      const [tab, setTab] = useState(() => {
        try {
          return localStorage.getItem(TAB_KEY)
            || localStorage.getItem("dsh-feishu-channels.sidebar-tab")
            || localStorage.getItem("dsh-automation.sidebar-tab") || "tasks";
        } catch { return "tasks"; }
      });
      const sessionSnap = typeof rawUseSessions === "function"
        ? rawUseSessions((state) => state)
        : undefined;
      const currentId = typeof rawUseSessions === "function"
        ? rawUseSessions((state) => currentSessionId(state))
        : (props.selectedId || null);
      const sessionById = (sessionSnap && sessionSnap.byId) || {};
      const useTaskSessions = useCallback((selector, eq) => {
        if (typeof rawUseSessions !== "function") return selector({ ids: [], byId: {}, current: null });
        // 频道会话也出现在官方任务树；频道页签只是同一批会话的过滤视图。
        return rawUseSessions((state) => selector(applySessionFilters(state, nativeTabs)), eq);
      }, [rawUseSessions, nativeTabs, registryRevision]);
      useEffect(() => { ensureStyle(); }, []);
      useEffect(() => { try { localStorage.setItem(TAB_KEY, tab); } catch { /* ignore */ } }, [tab]);
      useEffect(() => {
        const onClick = (event) => {
          const target = event.target && event.target.closest ? event.target.closest("button") : null;
          if (!target) return;
          if (target.closest("[data-row-key]")) return;
          const label = target.getAttribute("aria-label") || target.innerText || target.textContent || "";
          if (isHostNewSessionControl(label)) setTab("tasks");
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
      }, []);
      const previousCurrentId = useRef(currentId);
      const tabFollowReady = useRef(false);
      useEffect(() => {
        const followed = followSidebarTab(
          { ready: tabFollowReady.current, previousId: previousCurrentId.current },
          currentId,
          extraTabs,
        );
        tabFollowReady.current = followed.ready;
        previousCurrentId.current = followed.previousId;
        if (followed.tab) setTab(followed.tab);
      }, [currentId, extraTabs, membershipRevision]);
      const hostOpen = props.openSession || props.open;
      const openListed = (id) => {
        openListedSession(resolveHostSessionId(id, sessionById), hostOpen);
      };
      const openSession = (id) => {
        if (nativeTabs && Array.isArray(nativeTabs.sessionOpeners)
          && nativeTabs.sessionOpeners.some((item) => item && item.id === "feishu-channel")) {
          openRegisteredSession(id, nativeTabs, hostOpen);
          return;
        }
        openListed(id);
      };
      const officialProps = Object.assign({}, props, { useSessions: useTaskSessions, t: officialT, openSession, open: openSession });
      const channelView = h(FeishuChannelPage, {
        ctx: props.ctx,
        t,
        permissionT: props.permissionT,
        modelT: props.modelT,
        presetT: props.presetT,
        currentSessionId: currentId,
        hostProps: props,
      });
      if (props.wide === false) return Official ? h(Official, officialProps) : null;
      const officialTree = Official
        ? h("div", { className: "dfc-official-tree" }, h(Official, officialProps))
        : null;
      const visibleTab = resolveSidebarTab(tab, extraTabs);
      const localFeishuTab = {
        id: "feishu",
        order: 30,
        label: t("rail.feishu"),
        matchSession: isChannelSession,
        local: true,
      };
      const allTabs = [localFeishuTab, ...extraTabs].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      const activeExtra = extraTabs.find((item) => item.id === visibleTab);
      const feishuTabLabel = feishuTabLabelNode(t);
      const imTabItems = [
        {
          value: "tasks",
          id: "dfc-tab-tasks",
          panelId: "dfc-panel-tasks",
          label: h("span", { className: "dfc-tab-inline" },
            h(IconFolderClose, { size: 14 }),
            h("span", null, t("rail.tasks")),
          ),
        },
      ];
      for (const item of allTabs) {
        const itemLabel = item.id === "feishu"
          ? feishuTabLabel
          : item.id === "channels"
            ? h("span", { className: "dfc-tab-inline" },
                h(IconQueueOutline, { size: 14 }),
                h("span", null, item.label),
              )
            : item.id === "schedule"
              ? h("span", { className: "dfc-tab-inline" },
                  h(IconClockOutline, { size: 14 }),
                  h("span", null, item.label),
                )
              : item.label;
        imTabItems.push({
          value: item.id,
          id: "dfc-tab-" + item.id,
          panelId: "dfc-panel-" + item.id,
          label: itemLabel,
        });
      }

      return h("div", { className: "dfc-wrap" },
        HostSegmentedTabs
          ? h("div", { className: "dfc-tabs-wrap", style: { "--dfc-tab-count": String(imTabItems.length) } },
              h(HostSegmentedTabs, {
                className: "dfc-segmented-tabs",
                label: t("rail.tabsAria"),
                value: visibleTab,
                onChange: (next) => setTab(next),
                items: imTabItems,
              }),
            )
          : h("div", { className: "dfc-tabs", role: "tablist", "aria-label": t("rail.tabsAria") },
              h("button", { type: "button", role: "tab", "aria-selected": visibleTab === "tasks", className: visibleTab === "tasks" ? "dfc-tab on" : "dfc-tab", onClick: () => setTab("tasks") }, t("rail.tasks")),
              ...allTabs.map((item) => h("button", {
                key: item.id,
                type: "button",
                role: "tab",
                "aria-selected": visibleTab === item.id,
                className: visibleTab === item.id ? "dfc-tab on" : "dfc-tab",
                onClick: () => setTab(item.id),
              }, item.id === "feishu" ? feishuTabLabel : item.label)),
            ),
        visibleTab === "tasks"
          ? (officialTree || h(ChannelUnavailable, { t }))
          : visibleTab === "feishu"
            ? channelView
            : activeExtra
              ? activeExtra.render(Object.assign({}, props, { t: officialT, openSession, open: openSession }))
              : channelView,
      );
    }

    function sidebarOccupantName(item) {
      return String(
        item?.options?.locale ??
        item?.options?.id ??
        item?.options?.name ??
        item?.options?.registrant ??
        item?.component?.displayName ??
        item?.component?.name ??
        item?.id ??
        item?.name ??
        "",
      );
    }

    /** 只认真正占用 sidebar 槽的主人。包在注册表里但没接管侧栏时，必须走原生页签。 */
    function hasDshCodexUiSidebar(ctx) {
      try {
        const read = ctx.slots && (ctx.slots.entriesOfSlot || ctx.slots.entries);
        const sidebar = read && read.call(ctx.slots, "sidebar");
        if (!sidebar) return false;
        for (const item of sidebar) {
          if (/dsh-codex-ui|michengai-codex-ui|michengai\.codexUi|codex-ui/i.test(sidebarOccupantName(item))) return true;
        }
      } catch { /* ignore */ }
      return false;
    }

    /**
     * 侧栏包装兜底（Issue #13）。插件是用自己的一层替换宿主 sidebar.workspaces 的官方会话列表组件的：
     * 这层只要渲染失败，宿主的槽位错误边界就给这块画一个空的 crash div ——「左侧会话记录不显示」。
     * 这里接住错误，直接回落到宿主原本的官方组件（用宿主自己传进来的 props），
     * 宁可少一个频道页签，也不能让会话列表整个消失。
     */
    class ImSidebarFallbackBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error) {
        console.warn("[dsh-feishu-channels] 侧栏包装渲染失败，已回落到宿主原生会话列表", error);
      }
      render() {
        if (this.state.failed) {
          const Official = this.props.officialTree;
          return Official ? h(Official, this.props.hostProps) : null;
        }
        return this.props.children;
      }
    }

    class DfcSettingsBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
      }
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error) {
        console.warn("[dsh-feishu-channels] 设置页渲染失败", error);
      }
      render() {
        if (this.state.failed) {
          return h("section", { className: "dfc-page", "aria-label": "飞书频道" },
            h("h2", { className: "dfc-title" }, "飞书频道"),
            h("p", { className: "dfc-sub" }, "设置页加载失败。请刷新页面；若仍失败，请在插件管理器中禁用本插件并查看控制台错误。"));
        }
        return this.props.children;
      }
    }

    function pickOfficialWorkspaces(ctx) {
      const read = ctx.slots.entriesOfSlot || ctx.slots.entries;
      const entries = (read && read.call(ctx.slots, "sidebar.workspaces")) || [];
      for (const item of entries) {
        if (!item || !item.component) continue;
        if (isWrappedWorkspaceComponent(item.component)) continue;
        return item;
      }
      return null;
    }

    function isWrappedWorkspaceComponent(component) {
      return !!component && (component.__dshNativeTabWrapped === true
        || component.__dshNativeTabHost === true
        || component.__dfcTabHost === true
        || component.__imConnectWrapped === true
        || component.__imConnectOriginal !== undefined
        || component.__dshAutomationWrapped === true
        || component.__dshAutomationOriginal !== undefined);
    }

    function apply(ctx) {
      ensureStyle();
      ctx.effect(() => {
        let pending = channelSessionIds.size > 0, flight = null, disposed = false;
        const refresh = (changed) => {
          pending = pending || changed;
          if (disposed || !pending || flight) return;
          const sessions = probeService(ctx, "sessions");
          if (!sessions || typeof sessions.refresh !== "function") return;
          const revision = channelMembershipRevision;
          flight = Promise.resolve().then(() => {
            if (disposed) return;
            return sessions.refresh();
          }).then(() => {
            if (disposed) return;
            const snapshot = sessions.list && typeof sessions.list.getSnapshot === "function" ? sessions.list.getSnapshot() : undefined;
            if (snapshot && snapshot.state === "error") return;
            if (revision === channelMembershipRevision) pending = false;
          }).catch(() => { /* 保留待处理状态，由下次渠道刷新重试 */ })
            .finally(() => { flight = null; });
        };
        requestHostSessionRefresh = refresh;
        return () => {
          disposed = true;
          if (requestHostSessionRefresh === refresh) requestHostSessionRefresh = () => {};
        };
      }, "feishu-channel: host session refresh");
      ctx.effect(() => channelRefresh.subscribe((data, error) => {
        if (error) console.warn("[dsh-feishu-channels] 无法刷新渠道会话归属", error);
      }), "feishu-channel: channel membership");
      ctx.effect(() => ctx.locale.register(DFC_LOCALE_NS, DFC_LOCALES), "feishu-channel: dictionaries");
      const t = ctx.locale.bind(DFC_LOCALE_NS);
      const permissionT = ctx.locale.bind("permission.access");
      const modelT = ctx.locale.bind("model");
      const presetT = ctx.locale.bind("settings.agentPreset");
      const subscribeLocale = (listener) => ctx.locale.subscribe(listener);
      const localeSnapshot = () => ctx.locale.getSnapshot();
      const openChannelSettings = (request) => {
        const next = parseChannelSettingsRequest(request);
        if (!next) return;
        requestChannelSettings(next);
        openSettingsSection(
          [t("settings.label"), DFC_LOCALES.en["settings.label"], DFC_LOCALES.zh["settings.label"]],
          () => { requestChannelSettings(next); },
        );
      };
      const openImSettings = () => openImSettingsPage(t);
      function LocalizedSessionSwitcher(props) {
        useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
        const archiveSession = props.archiveSession || ((sessionId, options) => archiveHostSession(ctx, sessionId, options));
        const unarchiveSession = props.unarchiveSession || ((sessionId) => unarchiveHostSession(ctx, sessionId));
        return h(SessionSwitcher, Object.assign({}, props, {
          t,
          officialT: props.t,
          ctx,
          permissionT,
          modelT,
          presetT,
          openChannelSettings,
          openImSettings,
          archiveSession,
          unarchiveSession,
        }));
      }
      function LocalizedFeishuComposerGuard(props) {
        useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
        return h(FeishuComposerGuard, Object.assign({}, props, { t, ctx }));
      }
      function LocalizedSettingsPage(props) {
        useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot);
        return h(SettingsPage, Object.assign({}, props, { t, permissionT, modelT, presetT, readMainSessionModel: () => readMainSessionModel(ctx) }));
      }
      function SettingsSection(props) {
        return h(DfcSettingsBoundary, null, h(LocalizedSettingsPage, props));
      }
      openImSession = (id) => {
        try {
          if (window.__dshSessionsOpen) { window.__dshSessionsOpen(id); return true; }
        } catch { /* ignore */ }
        try { return openHostSession(ctx, id); }
        catch (error) { console.warn("[dsh-feishu-channels] 无法打开会话", id, error); return false; }
      };

      // 飞书会话只能通过飞书客户端继续；替换宿主 composer，避免本地输入被丢弃。
      // 有待批准/待回答交互时让位给宿主自己的交互 composer。
      ctx.slots.inject("conversation.composer", () => ctx.slots.register({
        name: "conversation.composer",
        select: (owner) => {
          if (!owner || !isChannelSession(owner.sessionId)) return null;
          if (owner.pendingInteraction) return null;
          return true;
        },
      }, LocalizedFeishuComposerGuard));

      // 频道会话行前显示所属频道品牌标，和定时任务的时钟图标同一套 leading 槽位。
      ctx.slots.inject("sidebar.session.row.leading", () => ctx.slots.register({
        name: "sidebar.session.row.leading",
        id: "feishu-channel-session-channel",
        order: 10,
      }, function ChannelSessionLeading({ sessionId }) {
        useSyncExternalStore(subscribeChannelMembership, channelMembershipSnapshot, channelMembershipSnapshot);
        const channelId = channelIdOfSession(sessionId);
        if (!channelId) return null;
        return h("span", { className: "dfc-session-channel-icon", "aria-hidden": "true" }, h(Logo, { id: channelId, small: true }));
      }));

      // 只包一层官方任务树，绝不在通知回调里再 register，否则会把启动卡在 Loading plugins。
      ctx.slots.inject("sidebar.workspaces", () => {
        let wrappedEntry = null;
        let originalComp = null;
        let ownedWrapper = null;
        let ownedRegistry = null;
        let removeInsertedTab = () => {};
        let removeInsertedOpener = () => {};
        let removeInsertedFilter = () => {};
        let ownedFilter = () => {};
        let stopInsertedTabLocale = () => {};
        let insertedTabRegistry = null;
        let syncing = false;
        // 与定时插件共享通知，补足直接替换 component 不触发宿主插槽通知的情况。
        const notifyPeers = () => { queueMicrotask(() => window.dispatchEvent(new Event("dsh-native-sidebar-change"))); };
        const installSessionOpener = (registry) => {
          if (!registry || typeof registry.addSessionOpener !== "function") return () => {};
          if (registry.sessionOpeners && registry.sessionOpeners.some((item) => item.id === "feishu-channel")) return () => {};
          return registry.addSessionOpener({
            id: "feishu-channel",
            order: 20,
            // 普通任务行也需要把宿主内部 key 解析成官方 session id；定时 opener 优先级更高。
            matchSession: (sessionId) => typeof sessionId === "string" && sessionId !== "",
            open: (sessionId, hostOpen) => {
              let byId;
              try { byId = ctx.sessions && ctx.sessions.list && ctx.sessions.list.getSnapshot ? ctx.sessions.list.getSnapshot().byId : undefined; } catch { byId = undefined; }
              openListedSession(resolveHostSessionId(sessionId, byId), hostOpen);
            },
          });
        };
        const clearInsertedTab = () => {
          stopInsertedTabLocale();
          stopInsertedTabLocale = () => {};
          removeInsertedTab();
          removeInsertedTab = () => {};
          removeInsertedOpener();
          removeInsertedOpener = () => {};
          removeInsertedFilter();
          removeInsertedFilter = () => {};
          insertedTabRegistry = null;
        };
        const unwrap = () => {
          clearInsertedTab();
          ownedFilter();
          ownedFilter = () => {};
          if (wrappedEntry) {
            if (originalComp && wrappedEntry.component === ownedWrapper) wrappedEntry.component = originalComp;
            if (wrappedEntry.__dshNativeTabs === ownedRegistry) delete wrappedEntry.__dshNativeTabs;
            notifyPeers();
          }
          wrappedEntry = null;
          originalComp = null;
          ownedWrapper = null;
          ownedRegistry = null;
        };
        const insertFeishuTab = (entry) => {
          const registry = findNativeTabRegistry(entry);
          if (!registry) return false;
          // Our own shell already renders the local "feishu" tab; never insert a duplicate
          // into our own registry (also protects a reloaded instance reusing an old shell).
          if (registry.__dfcOwner === true) return true;
          if (insertedTabRegistry !== registry) {
            clearInsertedTab();
            insertedTabRegistry = registry;
            removeInsertedOpener = installSessionOpener(registry);
            removeInsertedFilter = typeof registry.addSessionFilter === "function"
              ? registry.addSessionFilter((sessionId) => !String(sessionId).startsWith("dfc:"))
              : () => {};
          }
          if (registry.getTabs().some((item) => item.id === "feishu")) return true;
          const refreshInsertedTab = () => {
            removeInsertedTab = registry.insert({
              id: "feishu",
              label: feishuTabLabelNode(t),
              order: 30,
              matchSession: isChannelSession,
              render: (props) => h(ImSidebarFallbackBoundary, {
                officialTree: () => h(ChannelUnavailable, { t }),
                hostProps: props,
              }, h(FeishuChannelPage, Object.assign({}, props, {
                ctx,
                t,
                permissionT,
                modelT,
                presetT,
                hostProps: props,
              }))),
            });
          };
          refreshInsertedTab();
          const stopLocale = subscribeLocale(refreshInsertedTab);
          const stopMembership = subscribeChannelMembership(refreshInsertedTab);
          stopInsertedTabLocale = () => { stopLocale(); stopMembership(); };
          return true;
        };
        const sync = () => {
          if (syncing) return;
          syncing = true;
          try {
            const combo = hasDshCodexUiSidebar(ctx);
            if (combo) {
              unwrap();
              return;
            }
            const read = ctx.slots.entriesOfSlot || ctx.slots.entries;
            const entries = (read && read.call(ctx.slots, "sidebar.workspaces")) || [];
            const occupant = entries.find((item) => item && item.component);
            if (wrappedEntry && (occupant !== wrappedEntry || occupant.component !== ownedWrapper)) unwrap();
            if (!occupant) { clearInsertedTab(); return; }
            if (insertedTabRegistry && findNativeTabRegistry(occupant) !== insertedTabRegistry) clearInsertedTab();
            if (ownedWrapper && occupant.component === ownedWrapper) return;
            if (occupant && (occupant.component.__dshNativeTabHost || occupant.component.__dshNativeTabWrapped || occupant.component.__dshAutomationWrapped || findNativeTabRegistry(occupant))) {
              insertFeishuTab(occupant);
              return;
            }
            const official = pickOfficialWorkspaces(ctx);
            if (!official) return;
            originalComp = official.component;
            const registry = createNativeTabRegistry(originalComp);
            registry.__dfcOwner = true;
            ownedRegistry = registry;
            ownedFilter = registry.addSessionFilter((sessionId) => !String(sessionId).startsWith("dfc:"));
            removeInsertedOpener = installSessionOpener(registry);
            const tree = originalComp;
            attachNativeTabRegistry(official, registry);
            function DshNativeTabWorkspaceShell(innerProps) {
              return h(ImSidebarFallbackBoundary, { officialTree: tree, hostProps: innerProps },
                h(LocalizedSessionSwitcher, Object.assign({}, innerProps, { officialTree: tree, nativeTabs: registry })));
            }
            DshNativeTabWorkspaceShell.displayName = "DshNativeTabWorkspaceShell";
            DshNativeTabWorkspaceShell.__dshNativeTabHost = true;
            DshNativeTabWorkspaceShell.__dshNativeTabWrapped = true;
            DshNativeTabWorkspaceShell.__dshNativeTabOriginal = originalComp;
            DshNativeTabWorkspaceShell.__dshNativeTabOwner = "feishu-channel";
            DshNativeTabWorkspaceShell.__dfcTabHost = true;
            attachNativeTabRegistry(DshNativeTabWorkspaceShell, registry);
            official.component = DshNativeTabWorkspaceShell;
            ownedWrapper = DshNativeTabWorkspaceShell;
            wrappedEntry = official;
            notifyPeers();
          } catch (error) {
            console.warn("[dsh-feishu-channels] 包裹官方任务树失败", error);
          } finally {
            syncing = false;
          }
        };
        sync();
        const unsub = typeof ctx.slots.subscribe === "function" ? ctx.slots.subscribe("sidebar.workspaces", sync) : () => {};
        const unsubSidebar = typeof ctx.slots.subscribe === "function" ? ctx.slots.subscribe("sidebar", sync) : () => {};
        window.addEventListener("dsh-native-sidebar-change", sync);
        // 其他插件直接替换 component/注册表时不一定触发槽位通知，短暂重试兼容加载顺序。
        let retries = 0;
        const retryTimer = window.setInterval(() => {
          sync();
          if (insertedTabRegistry || ++retries >= 20) window.clearInterval(retryTimer);
        }, 250);
        return () => { window.clearInterval(retryTimer); unsub(); unsubSidebar(); window.removeEventListener("dsh-native-sidebar-change", sync); unwrap(); };
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
