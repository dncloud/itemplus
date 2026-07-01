package core

import (
	aicore "github.com/itemplus/backend/internal/core/ai"
	authcore "github.com/itemplus/backend/internal/core/auth"
	updatecore "github.com/itemplus/backend/internal/core/updates"
	"github.com/itemplus/backend/internal/printing"
	printtemplates "github.com/itemplus/backend/internal/printing/templates"
)

type JWTClaims = authcore.JWTClaims
type AppleClaims = authcore.AppleClaims

type AISettings = aicore.AISettings
type AIConnectionTestResult = aicore.AIConnectionTestResult
type AIModelOption = aicore.AIModelOption
type AIUsage = aicore.AIUsage
type AIDebugError = aicore.AIDebugError
type ParseItemIntentRequest = aicore.ParseItemIntentRequest
type AIImageInput = aicore.AIImageInput
type ParseItemIntentResult = aicore.ParseItemIntentResult
type AIStreamEvent = aicore.AIStreamEvent
type ChatMessage = aicore.ChatMessage
type ChatRequest = aicore.ChatRequest
type ChatResult = aicore.ChatResult
type InventoryLookupRequest = aicore.InventoryLookupRequest
type InventoryLookupPlan = aicore.InventoryLookupPlan
type AICategoryProposal = aicore.AICategoryProposal
type AIPropertyProposal = aicore.AIPropertyProposal
type SuggestCategoryPropertiesRequest = aicore.SuggestCategoryPropertiesRequest
type SuggestCategoryPropertiesResult = aicore.SuggestCategoryPropertiesResult
type SuggestPropertyEnhancementRequest = aicore.SuggestPropertyEnhancementRequest
type SuggestPropertyEnhancementResult = aicore.SuggestPropertyEnhancementResult
type AIVendorAddressProposal = aicore.AIVendorAddressProposal
type AIVendorProposal = aicore.AIVendorProposal
type SuggestVendorRequest = aicore.SuggestVendorRequest
type SuggestVendorResult = aicore.SuggestVendorResult
type VendorLogoPreviewCandidate = aicore.VendorLogoPreviewCandidate
type VendorLogoPreviewResult = aicore.VendorLogoPreviewResult
type AITempImage = aicore.AITempImage

type LabelTemplateDefinition = printtemplates.LabelTemplateDefinition
type LabelTemplateVariable = printtemplates.LabelTemplateVariable

type UpdateStatus = updatecore.UpdateStatus
type GitHubRelease = updatecore.GitHubRelease
type GitHubReleaseAsset = updatecore.GitHubReleaseAsset
type GitHubRef = updatecore.GitHubRef
type GitHubTag = updatecore.GitHubTag
type GitHubCommit = updatecore.GitHubCommit

const UpdateStatusSettingKey = updatecore.UpdateStatusSettingKey

var (
	CreateToken                                         = authcore.CreateToken
	DecodeToken                                         = authcore.DecodeToken
	DecodeAppleToken                                    = authcore.DecodeAppleToken
	SendMagicLink                                       = authcore.SendMagicLink
	ChatWithAIStream                                    = aicore.ChatWithAIStream
	ParseItemIntent                                     = aicore.ParseItemIntent
	ParseItemIntentStream                               = aicore.ParseItemIntentStream
	PlanInventoryLookup                                 = aicore.PlanInventoryLookup
	DefaultChatPromptTemplateForProvider                = aicore.DefaultChatPromptTemplateForProvider
	DefaultParseItemPromptTemplateForProvider           = aicore.DefaultParseItemPromptTemplateForProvider
	DefaultCategoryPropertyPromptTemplateForProvider    = aicore.DefaultCategoryPropertyPromptTemplateForProvider
	DefaultPropertyEnhancementPromptTemplateForProvider = aicore.DefaultPropertyEnhancementPromptTemplateForProvider
	DefaultVendorPromptTemplateForProvider              = aicore.DefaultVendorPromptTemplateForProvider
	SaveAITempImage                                     = aicore.SaveAITempImage
	GetAITempImage                                      = aicore.GetAITempImage
	DeleteAITempImage                                   = aicore.DeleteAITempImage
	SuggestCategoryProperties                           = aicore.SuggestCategoryProperties
	SuggestPropertyEnhancement                          = aicore.SuggestPropertyEnhancement
	SuggestVendor                                       = aicore.SuggestVendor
	TestAIConnection                                    = aicore.TestAIConnection
	ListOpenAIModels                                    = aicore.ListOpenAIModels
	ResolveVendorLogoPreview                            = aicore.ResolveVendorLogoPreview
	DefaultLabelTemplates                               = printtemplates.DefaultLabelTemplates
	LabelTemplateVariables                              = printtemplates.LabelTemplateVariables
	SupportedTSPLCommands                               = printtemplates.SupportedTSPLCommands
	IsValidLabelTemplateTarget                          = printtemplates.IsValidLabelTemplateTarget
	ValidateLabelTemplateDefinition                     = printtemplates.ValidateLabelTemplateDefinition
	IsValidLabelTemplateDPI                             = printtemplates.IsValidLabelTemplateDPI
	ValidateLabelTemplateDefinitionWithDPI              = printtemplates.ValidateLabelTemplateDefinitionWithDPI
	CompactQR                                           = printing.CompactQR
	SendTSPL                                            = printing.SendTSPL
	EnsureTSPLTerminated                                = printing.EnsureTSPLTerminated
	TestPrinterConnection                               = printing.TestPrinterConnection
	CheckForUpdates                                     = updatecore.CheckForUpdates
	CheckForUpdatesForVersion                           = updatecore.CheckForUpdatesForVersion
	SplitVersionDisplay                                 = updatecore.SplitVersionDisplay
	FetchLatestRelease                                  = updatecore.FetchLatestRelease
	SelectServerReleaseAsset                            = updatecore.SelectServerReleaseAsset
	SameCommit                                          = updatecore.SameCommit
	CompareVersions                                     = updatecore.CompareVersions
)
