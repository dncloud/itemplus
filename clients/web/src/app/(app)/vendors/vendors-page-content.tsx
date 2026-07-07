"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { api, type AIProfile, type AIUsage, type AIVendorSuggestionResult, type Vendor, type VendorLogoPreviewResult } from "@/lib/api";
import { type AIChatEntry, createAIChatId } from "@/lib/ai-chat";
import { useApp } from "@/lib/app-context";
import { ChevronRight, Sparkles } from "lucide-react";
import { useDeleteFlow, ConfirmDelete } from "@/components/ui/confirm-delete";
import { AIDrawerChatMessage, AIDrawerTabs, AIRawDebugPanel, AIInfoDrawer, AIUsageBadges } from "@/components/ai/drawer";
import {
  buildVendorLogoSuggestion,
  buildVendorSuggestionEntries,
  type EntityType,
  TABS,
  VendorAIProposalPanel,
  VendorInlineForm,
  VendorList,
  VendorSearchBar,
  VendorTabs,
} from "./vendors-sections";
import {
  deleteVendorDraft,
  fetchVendorsPageData,
  filterVendors,
  saveVendorDraft,
  suggestVendorDraft,
  validateVendorDraft,
} from "./vendors-page-utils";

export default function VendorsPageContent() {
  const { realm, locale, fmtDateTime, t, can, currentUserLabel, setAiAssistantBusy, setAiAssistantPanelController } = useApp();
  const [tab, setTab] = useState<EntityType>("manufacturers");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Partial<Vendor> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [allItems, setAllItems] = useState<Vendor[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<AIVendorSuggestionResult | null>(null);
  const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);
  const [activeAIProfile, setActiveAIProfile] = useState<AIProfile | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiChat, setAiChat] = useState<AIChatEntry[]>([]);
  const [aiTab, setAiTab] = useState<"chat" | "raw">("chat");
  const [aiRawDebug, setAiRawDebug] = useState("");
  const [aiSuggestionAnchorMessageId, setAiSuggestionAnchorMessageId] = useState<string | null>(null);
  const [aiAllowWebSearch, setAiAllowWebSearch] = useState(true);
  const [aiLogoSuggestion, setAiLogoSuggestion] = useState<VendorLogoPreviewResult | null>(null);
  const [logoSourceUrl, setLogoSourceUrl] = useState("");
  const [logoImportBusy, setLogoImportBusy] = useState(false);
  const [logoImportError, setLogoImportError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const loadingRef = useRef(false);
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      setAllItems(await fetchVendorsPageData(realm, tab));
    } catch {}
    setLoading(false);
    loadingRef.current = false;
  }, [realm, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteFlow = useDeleteFlow({
    realm,
    onDeleted: useCallback(() => {
      load();
    }, [load]),
  });
  const items = useMemo(
    () => filterVendors(allItems, search),
    [allItems, search],
  );
  const pendingDeleteVendorId = deleteFlow.pending ? deleteFlow.pending.id : null;

  const [validationError, setValidationError] = useState<string | null>(null);
  const canWriteVendors = can("vendors.write");
  const canDeleteVendors = can("vendors.delete");
  const aiUserName = currentUserLabel || t("vendors.aiUserFallback");
  const aiAssistantName = t("vendors.aiAssistantName");
  const modelBadge = activeAIProfile ? `${activeAIProfile.provider === "ollama" ? "Ollama" : "OpenAI"} · ${activeAIProfile.model}` : null;

  const resetAISession = useCallback(() => {
    setAiPrompt("");
    setAiBusy(false);
    setAiResult(null);
    setAiUsage(null);
    setAiDrawerOpen(false);
    setAiChat([]);
    setAiTab("chat");
    setAiRawDebug("");
    setAiSuggestionAnchorMessageId(null);
    setAiLogoSuggestion(null);
  }, []);

  const markChatEntrySeen = useCallback((id: string) => {
    setAiChat((current) => current.map((entry) => (entry.id === id && entry.animate ? { ...entry, animate: false } : entry)));
  }, []);

  useEffect(() => {
    if (!canWriteVendors) return;
    void api.getAISettings()
      .then((settings) => {
        const profile = settings.profiles.find((entry) => entry.id === settings.active_profile_id) || settings.profiles[0] || null;
        setActiveAIProfile(profile && profile.enabled ? profile : null);
      })
      .catch(() => {
        setActiveAIProfile(null);
      });
  }, [canWriteVendors]);

  useEffect(() => {
    resetAISession();
  }, [realm, tab, editItem?.id, isNew, resetAISession]);

  useEffect(() => {
    setSearch("");
    setEditItem(null);
    setIsNew(false);
    setValidationError(null);
  }, [realm]);

  useEffect(() => {
    setLogoSourceUrl("");
    setLogoImportBusy(false);
    setLogoImportError(null);
  }, [editItem?.id, isNew, tab]);

  useEffect(() => {
    setAiAssistantBusy(aiBusy);
    return () => setAiAssistantBusy(false);
  }, [aiBusy, setAiAssistantBusy]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [aiPrompt]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [aiChat, aiResult]);

  useEffect(() => {
    const vendorName = String(aiResult?.vendor?.name || editItem?.name || "").trim();
    const website = String(aiResult?.vendor?.website || editItem?.website || "").trim();
    const supportURL = String(aiResult?.vendor?.support_url || editItem?.support_url || "").trim();
    const externalLogoURL = String(aiResult?.vendor?.external_logo_url || editItem?.external_logo_url || "").trim();
    const hasAIProposal = !!aiResult?.vendor;
    const hasUsableWebsite = looksLikeVendorLogoSource(website);
    const hasUsableSupportURL = looksLikeVendorLogoSource(supportURL);
    const hasUsableExternalLogoURL = looksLikeVendorLogoSource(externalLogoURL);
    const hasUsableSource = hasUsableWebsite || hasUsableSupportURL || hasUsableExternalLogoURL;
    const allowNameOnlyLookup = hasAIProposal && vendorName.length >= 3;

    if (!hasUsableSource && !allowNameOnlyLookup) {
      setAiLogoSuggestion(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.resolveVendorLogo({
        name: vendorName,
        website: hasUsableWebsite ? website : "",
        support_url: hasUsableSupportURL ? supportURL : "",
        external_logo_url: hasUsableExternalLogoURL ? externalLogoURL : "",
      })
        .then((result) => {
          if (cancelled) return;
          setAiLogoSuggestion(result);
        })
        .catch(() => {
          if (cancelled) return;
          setAiLogoSuggestion(null);
        });
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [aiResult?.vendor, editItem?.external_logo_url, editItem?.name, editItem?.support_url, editItem?.website]);

  useEffect(() => {
    if (!aiLogoSuggestion || aiSuggestionAnchorMessageId) return;
    const lastAssistant = [...aiChat].reverse().find((entry) => entry.role === "assistant" && !entry.pending);
    if (lastAssistant) {
      setAiSuggestionAnchorMessageId(lastAssistant.id);
    }
  }, [aiChat, aiLogoSuggestion, aiSuggestionAnchorMessageId]);

  useEffect(() => {
    const sessionAvailable = aiDrawerOpen || aiBusy || aiChat.length > 0;
    if (!sessionAvailable) {
      setAiAssistantPanelController(null);
      return;
    }

    setAiAssistantPanelController({
      available: true,
      open: aiDrawerOpen,
      toggle: () => setAiDrawerOpen((open) => !open),
    });
  }, [aiBusy, aiChat.length, aiDrawerOpen, setAiAssistantPanelController]);

  useEffect(() => {
    return () => setAiAssistantPanelController(null);
  }, [setAiAssistantPanelController]);

  const save = async () => {
    if (!canWriteVendors) return;
    if (!editItem?.name) return;
    const error = validateVendorDraft(editItem, t);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    try {
      await saveVendorDraft({ realm, tab, draft: editItem, isNew });
      setEditItem(null);
      load();
    } catch {}
  };

  const importLogoFromSource = useCallback(async () => {
    const sourceUrl = logoSourceUrl.trim();
    if (!sourceUrl) {
      setLogoImportError(null);
      return;
    }
    if (!/^https?:\/\/.+/i.test(sourceUrl)) {
      setLogoImportError(t("vendors.invalidLogoSourceUrl"));
      return;
    }

    setLogoImportBusy(true);
    setLogoImportError(null);
    try {
      const result = await api.resolveVendorLogo({ name: String(editItem?.name || "").trim(), external_logo_url: sourceUrl });
      const bestCandidate = result.candidates.find((candidate) => String(candidate.data_url || "").trim()) || null;
      if (!bestCandidate?.data_url) {
        setLogoImportError(t("vendors.logoSourceNoImage"));
        return;
      }
      setEditItem((current) => (current ? { ...current, logo: bestCandidate.data_url } : current));
    } catch {
      setLogoImportError(t("vendors.logoSourceFailed"));
    } finally {
      setLogoImportBusy(false);
    }
  }, [editItem?.name, logoSourceUrl, t]);

  const runAI = useCallback(async () => {
    if (!canWriteVendors || !editItem) return;
    const name = String(editItem.name || "").trim();
    if (!name) {
      setAiDrawerOpen(true);
      setAiChat((current) => [
        ...current,
        {
          id: createAIChatId("vendor-ai-assistant"),
          role: "assistant",
          content: t("vendors.aiNoName"),
          animate: true,
        },
      ]);
      return;
    }
    const task = aiPrompt.trim();
    const userMessage = task || name;
    const prompt = task ? `${name}\n\n${task}` : name;
    const assistantMessageId = createAIChatId("vendor-ai-assistant");
    setAiDrawerOpen(true);
    setAiBusy(true);
    setAiResult(null);
    setAiSuggestionAnchorMessageId(null);
    setAiChat((current) => [
      ...current,
      { id: createAIChatId("vendor-ai-user"), role: "user", content: userMessage },
      { id: assistantMessageId, role: "assistant", content: t("vendors.aiThinking"), pending: true },
    ]);
    setAiPrompt("");
    try {
      const result = await suggestVendorDraft({
        realm,
        tab,
        prompt,
        locale,
        allowWebSearch: aiAllowWebSearch,
        draft: editItem,
      });
      setAiResult(result);
      setAiUsage(result.usage || null);
      setAiRawDebug(result.raw_debug || "");
      const suggestionCount = buildVendorSuggestionEntries(tab, result.vendor, t).length;
      setAiSuggestionAnchorMessageId(suggestionCount > 0 ? assistantMessageId : null);
      const assistantContent =
        result.assistant_message?.trim() ||
        (result.questions.length > 0 ? result.questions.join("\n") : t("vendors.aiSuggestionsReady"));
      setAiChat((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId
            ? { ...entry, content: assistantContent, pending: false, animate: true }
            : entry,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("vendors.aiFailed");
      const usage = error && typeof error === "object" && "usage" in error ? ((error as { usage?: AIUsage }).usage || null) : null;
      const rawDebug = error && typeof error === "object" && "raw_debug" in error ? String((error as { raw_debug?: string }).raw_debug || "") : "";
      setAiUsage(usage);
      setAiRawDebug(rawDebug);
      setAiChat((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId
            ? { ...entry, content: message, pending: false, animate: true }
            : entry,
        ),
      );
    } finally {
      setAiBusy(false);
    }
  }, [aiAllowWebSearch, aiPrompt, canWriteVendors, editItem, locale, realm, t, tab]);

  const openAIDrawer = useCallback(() => {
    setAiDrawerOpen(true);
    setAiTab("chat");
  }, []);

  const endAISession = useCallback(() => {
    resetAISession();
  }, [resetAISession]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (aiBusy) return;
      void runAI();
    }
  }, [aiBusy, runAI]);

  const applyAISuggestion = useCallback((key: string) => {
    if (!aiResult?.vendor) return;
    setEditItem((current) => {
      if (!current) return current;
      const next: Partial<Vendor> = { ...current };
      if (key.startsWith("address.")) {
        const addressKey = key.slice("address.".length) as "street" | "house_number" | "zip" | "city";
        const addressValue = aiResult.vendor.address?.[addressKey];
        next.address = { ...(next.address || {}), [addressKey]: addressValue || "" };
        return next;
      }
      const value = aiResult.vendor[key as keyof typeof aiResult.vendor];
      return { ...next, [key]: typeof value === "string" ? value : value || undefined };
    });
  }, [aiResult]);

  const applyAllAISuggestions = useCallback(() => {
    if (!aiResult?.vendor) return;
    setEditItem((current) => {
      if (!current) return current;
      const next: Partial<Vendor> = { ...current };
      const proposal = aiResult.vendor;
      for (const key of ["name", "website", "email", "phone", "contact_person", "customer_number", "account_manager", "support_email", "support_phone", "support_url"] as const) {
        const value = proposal[key];
        if (typeof value === "string" && value.trim()) {
          next[key] = value;
        }
      }
      if (proposal.address) {
        next.address = {
          ...(next.address || {}),
          ...(proposal.address.street ? { street: proposal.address.street } : {}),
          ...(proposal.address.house_number ? { house_number: proposal.address.house_number } : {}),
          ...(proposal.address.zip ? { zip: proposal.address.zip } : {}),
          ...(proposal.address.city ? { city: proposal.address.city } : {}),
        };
      }
      return next;
    });
  }, [aiResult]);

  const applyAILogoSuggestion = useCallback((logoUrl: string) => {
    if (!logoUrl) return;
    setEditItem((current) => (current ? {
      ...current,
      logo: logoUrl,
    } : current));
  }, []);

  const remove = (id: number) => {
    if (!canDeleteVendors) return;
    const item = allItems.find((i) => i.id === id);
    deleteFlow.requestDelete(id, item?.name || `#${id}`, tab === "sales-platforms" ? "sales_platform" : tab.slice(0, -1));
  };

  const currentTab = TABS.find((t) => t.key === tab)!;
  const tabLabel = t(currentTab.labelKey);

  return (
    <div className="space-y-6">
      <div className="mb-4 text-center sm:flex sm:items-center sm:justify-between sm:text-left lg:mb-8">
        <div className="space-y-1 py-3">
          <nav className="text-sm font-medium dark:text-gray-100">
            <ol className="flex items-center justify-center sm:justify-start">
              <li>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-500 dark:text-gray-400">{realm === "archive" ? t("realm.archive") : t("realm.collection")}</li>
              <li className="flex items-center px-1 opacity-25">
                <ChevronRight className="inline-block h-5 w-5" />
              </li>
              <li className="text-gray-900 dark:text-white">{t("vendors.title")}</li>
            </ol>
          </nav>
          <h2 className="text-2xl font-bold">{t("vendors.title")}</h2>
        </div>
      </div>

      {/* Tabs */}
      <VendorTabs tab={tab} onSelect={(nextTab) => { setTab(nextTab); setSearch(""); }} t={t} />

      <VendorSearchBar
        search={search}
        onSearchChange={setSearch}
        onCreate={() => { resetAISession(); setEditItem({ name: "" }); setIsNew(true); }}
        canCreate={canWriteVendors}
        t={t}
      />

      {canWriteVendors && editItem && isNew ? (
        <div className="overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-gray-900/5 dark:bg-gray-800/50 dark:outline-white/10">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-white/10">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t("common.new")} {tabLabel}</h3>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <VendorInlineForm
              editItem={editItem}
              setEditItem={setEditItem}
              isNew={isNew}
              tab={tab}
              currentTabIcon={currentTab.icon}
              validationError={validationError}
              setValidationError={setValidationError}
              logoSourceUrl={logoSourceUrl}
              onLogoSourceUrlChange={(value) => {
                setLogoSourceUrl(value);
                if (logoImportError) setLogoImportError(null);
              }}
              onImportLogoFromSource={() => { void importLogoFromSource(); }}
              logoImportBusy={logoImportBusy}
              logoImportError={logoImportError}
              showAIButton={Boolean(activeAIProfile)}
              aiBusy={aiBusy}
              onRunAI={openAIDrawer}
              save={save}
              onCancel={() => { resetAISession(); setEditItem(null); setValidationError(null); setIsNew(false); }}
              t={t}
            />
          </div>
        </div>
      ) : null}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-10">{t("vendors.none")}</p>
      ) : (
        <VendorList
          items={items}
          currentTabIcon={currentTab.icon}
          fmtDateTime={fmtDateTime}
          onEdit={(item) => {
            if (!canWriteVendors) return;
            if (editItem?.id === item.id && !isNew) {
              resetAISession();
              setEditItem(null);
              setValidationError(null);
              return;
            }
            resetAISession();
            setEditItem({ ...item });
            setIsNew(false);
            setValidationError(null);
          }}
          onDelete={remove}
          pendingDeleteId={pendingDeleteVendorId}
          canEdit={canWriteVendors}
          canDelete={canDeleteVendors}
          renderEditor={(item) => canWriteVendors && editItem?.id === item.id && !isNew ? (
            <div className="border-t border-gray-100 px-4 py-4 sm:px-6 dark:border-white/10">
              <VendorInlineForm
                editItem={editItem}
                setEditItem={setEditItem}
                isNew={isNew}
                tab={tab}
                currentTabIcon={currentTab.icon}
                validationError={validationError}
                setValidationError={setValidationError}
                logoSourceUrl={logoSourceUrl}
                onLogoSourceUrlChange={(value) => {
                  setLogoSourceUrl(value);
                  if (logoImportError) setLogoImportError(null);
                }}
                onImportLogoFromSource={() => { void importLogoFromSource(); }}
                logoImportBusy={logoImportBusy}
                logoImportError={logoImportError}
                showAIButton={Boolean(activeAIProfile)}
                aiBusy={aiBusy}
                onRunAI={openAIDrawer}
                save={save}
                onCancel={() => { resetAISession(); setEditItem(null); setValidationError(null); setIsNew(false); }}
                t={t}
              />
            </div>
          ) : null}
          t={t}
        />
      )}

      {canWriteVendors && editItem && activeAIProfile ? (
        <AIInfoDrawer
          open={aiDrawerOpen}
          onClose={() => setAiDrawerOpen(false)}
          title={t("vendors.aiInfoTitle")}
          subtitle={t("vendors.aiInfoSubtitle")}
          bodyClassName="mt-6 flex min-h-0 flex-1 flex-col gap-4 px-4 sm:px-6"
        >
          <AIDrawerTabs t={t} activeTab={aiTab} onChange={setAiTab} />

          {aiTab === "chat" ? (
            <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
              <div className="space-y-5 pb-2">
                {aiChat.length > 0 ? (
                  aiChat.map((message) => (
                    <div key={message.id} className="space-y-3">
                      <AIDrawerChatMessage
                        role={message.role}
                        name={message.role === "user" ? aiUserName : aiAssistantName}
                        content={message.content}
                        pending={message.pending}
                        animate={message.animate}
                        onAnimationDone={message.role === "assistant" ? () => markChatEntrySeen(message.id) : undefined}
                      />
                      {message.role === "assistant" && aiSuggestionAnchorMessageId === message.id ? (
                        <div className="flex justify-start">
                          <div className="w-full max-w-[88%]">
                            <VendorAIProposalPanel
                              tab={tab}
                              proposal={aiResult?.vendor || null}
                              logoSuggestion={buildVendorLogoSuggestion(aiLogoSuggestion)}
                              suggestionEntries={buildVendorSuggestionEntries(tab, aiResult?.vendor || null, t)}
                              onApplyLogo={applyAILogoSuggestion}
                              onApplySuggestion={applyAISuggestion}
                              onApplyAll={applyAllAISuggestions}
                              t={t}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-6 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                    {t("vendors.aiInfoEmpty")}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
              <AIRawDebugPanel t={t} rawDebug={aiRawDebug} />
            </div>
          )}

          <div className="shrink-0 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-gray-950/20">
            <textarea
              ref={composerRef}
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={1}
              placeholder={t("vendors.aiReplyPlaceholder")}
              className="min-h-[44px] w-full resize-none overflow-hidden bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-500 dark:text-white"
            />
            <div className="mt-2">
              <AIUsageBadges t={t} modelBadge={modelBadge} usage={aiUsage} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                {aiChat.length > 0 ? (
                  <button
                    type="button"
                    onClick={endAISession}
                    className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                  >
                    {t("vendors.aiEndSession")}
                  </button>
                ) : null}
                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={aiAllowWebSearch}
                    onChange={(event) => setAiAllowWebSearch(event.target.checked)}
                    className="accent-blue-500"
                  />
                  {t("chat.allowWebSearch")}
                </label>
              </div>
              <button
                type="button"
                onClick={() => { void runAI(); }}
                disabled={aiBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {aiBusy ? t("vendors.aiRunning") : t("common.send")}
              </button>
            </div>
          </div>
        </AIInfoDrawer>
      ) : null}

      {/* Confirm Delete */}
      {canDeleteVendors && deleteFlow.confirm && (
        <ConfirmDelete
          name={deleteFlow.confirm.name}
          t={t}
          onConfirm={async () => {
            try {
              await deleteVendorDraft(realm, tab, deleteFlow.confirm!.id);
              load();
            } catch {}
            deleteFlow.cancelConfirm();
          }}
          onCancel={() => deleteFlow.cancelConfirm()}
        />
      )}
    </div>
  );
}

function looksLikeVendorLogoSource(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\/.+/i.test(trimmed)) return true;
  return /^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed);
}
