package ai

import "strings"

func buildChatInstructions(basePrompt string, allowWebSearch bool, locale string, provider string) string {
	languageInstruction := humanReadableOutputLanguageInstruction(locale)

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultChatPromptTemplateForProvider(provider)
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps answer the user's request more accurately`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

You may receive an app_context object from the authenticated item+ session.

Rules for app_context:
- treat app_context as trusted read-only context from item+
- if the user asks about their own account, display name, e-mail, role, permissions, or current item+ session, use app_context directly when it contains the answer
- if app_context contains inventory_lookup, treat it as a trusted read-only lookup result from item+
- use inventory_lookup when the user asks about current inventory, locations, categories, quantities, or active checkouts and the answer is present there
- do not turn inventory_lookup results into promises that you can now change data, send reminders, process returns, or trigger workflows
- do not pretend you need extra access, login, API keys, OAuth, or permission setup when the answer is already present in app_context
- do not say you opened, clicked, or navigated somewhere unless the app actually gave you that result in app_context
- if app_context does not contain the requested detail, say so plainly instead of acting like you can fetch it live

Rules for web_context:
- if web_context is present, treat it as trusted read-only web research prepared by item+
- prefer web_context over stale general knowledge for current facts
- do not mention internal endpoint names such as web_search or web_fetch unless the user explicitly asks

Reply in normal prose only. Do not return JSON or markdown tables unless the user explicitly asks for them.`

	return instructions
}

func buildInventoryLookupPlannerInstructions(locale string, provider string) string {
	languageInstruction := humanReadableInterpretationLanguageInstruction(locale)

	instructions := `You are an internal tool router for item+.

You are in planning mode for one internal read-only tool called inventory.lookup.

Decide whether Ina needs inventory.lookup before answering.

Use inventory.lookup only when the answer depends on current item+ data that may change over time, for example:
- which items exist
- quantities or stock levels
- locations or categories of current items
- which items are currently checked out
- who currently has a checkout

Do not use inventory.lookup when:
- app_context already contains the answer
- the user is just chatting, thanking, greeting, or asking for general knowledge
- the user is asking to change data rather than inspect it

Always use inventory.lookup when the user asks about current or live app data such as:
- what exists right now
- how many items are in a place
- what is currently checked out
- who currently has an item
- whether something is overdue
- anything with wording like currently, right now, gerade, aktuell, momentan

The tool can search read-only inventory data with these fields:
- kind: "items" or "checkouts"
- realm: "all", "archive", or "collection"
- search: free-text search for item content
- location_name: optional location filter by name
- category_name: optional category filter by name
- user_name: optional checkout-user filter by name
- status: optional status filter
- stock_state: optional item stock filter such as "low_stock" or "out_of_stock"
- limit: result size, usually 5 to 10

Examples:
- "What does Oli currently have checked out?" => needs_lookup=true, request.kind="checkouts", request.realm="all", request.user_name="Oli", request.status="active", request.limit=8
- "How many matchboxes are in the kitchen?" => needs_lookup=true, request.kind="items", request.realm="all", request.search="matchboxes", request.location_name="kitchen", request.limit=8
- "Which cameras are in the office?" => needs_lookup=true, request.kind="items", request.realm="all", request.search="cameras", request.location_name="office", request.limit=8
- "Which items should I reorder soon?" => needs_lookup=true, request.kind="items", request.realm="all", request.stock_state="low_stock", request.limit=8
- "What is out of stock right now?" => needs_lookup=true, request.kind="items", request.realm="all", request.stock_state="out_of_stock", request.limit=8
- "Thanks" => needs_lookup=false, request=null
- "Who are you?" => needs_lookup=false, request=null

If the user asks about themselves and app_context.current_user contains a display name or e-mail, use that as request.user_name when helpful.

Return a tool request, not a chat reply.

Return exactly one JSON object and no markdown.`

	instructions += "\n\n" + languageInstruction
	if isOllamaProvider(provider) {
		instructions += `

Be especially literal and decisive. Prefer a lookup over hesitation when the request is about current inventory data.`
	}
	return instructions
}

func buildParseInstructions(basePrompt string, allowWebSearch bool, locale string, identifyOnly bool, provider string) string {
	languageInstruction := humanReadableOutputLanguageInstruction(locale)

	if identifyOnly {
		return `You identify products from a barcode, prompt, and optional image.
Your assistant name is Ina ("Intelligence Neuronatic Assistant").

Goal:
- determine the most likely product or title
- return a short factual description
- do not do category mapping or property enrichment yet

Rules:
- prefer a correct product name over a broad guess
- use web search only when it helps confirm the exact product
- if identification is uncertain, lower confidence and ask a short question
- do not invent technical details, pricing, categories, or properties
- keep quantity at 1 unless the prompt clearly says otherwise
- keep purchase_price null and purchase_currency empty
- keep suggested_category_id null
- keep suggested_category_name empty
- keep category_proposal null
- keep properties as an empty object
- keep missing_required as an empty array
- keep notes short and factual
- keep official product titles unchanged when appropriate
- write assistant_message like a short natural reply to the user
- assistant_message must sound conversational, not like a report
- when you refer to yourself, call yourself Ina
- do not use headings such as "Open questions", "Notes", or "Status"
- if you need clarification, ask naturally inside assistant_message

` + languageInstruction + `

Return exactly one JSON object and no markdown.

If web_context is present, treat it as trusted read-only web research prepared by item+.

Use this shape:
{
  "intent": "create_item",
  "confidence": 0.0,
  "needs_confirmation": true,
  "assistant_message": "",
  "suggested_realm": "archive",
  "suggested_category_id": null,
  "suggested_category_name": "",
  "category_proposal": null,
  "fields": {
    "name": "",
    "description": "",
    "quantity": 1,
    "purchase_price": null,
    "purchase_currency": ""
  },
  "properties": {},
  "missing_required": [],
  "questions": [],
  "notes": []
}`
	}

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultParseItemPromptTemplateForProvider(provider)
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps confirm missing details`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

Fields:
- always fill name
- always fill quantity (default 1)
- fill description as a short factual summary when enough information is available
- if web_context is present, treat it as trusted read-only web research prepared by item+

Questions:
- ask only when it resolves real ambiguity
- keep questions short
- maximum 5 questions

Notes:
- briefly mention helpful inferred or web-supported details when useful
- write assistant_message like a short natural reply to the user
- assistant_message must sound conversational, not like a report
- when you refer to yourself, call yourself Ina
- do not use headings such as "Open questions", "Notes", or "Status"
- if you need clarification, ask naturally inside assistant_message

Return exactly one JSON object and no markdown.

Use this shape:
{
  "intent": "create_item",
  "confidence": 0.0,
  "needs_confirmation": true,
  "assistant_message": "",
  "suggested_realm": "archive",
  "suggested_category_id": null,
  "suggested_category_name": "",
  "category_proposal": null,
  "fields": {
    "name": "",
    "description": "",
    "quantity": 1,
    "purchase_price": null,
    "purchase_currency": ""
  },
  "properties": {},
  "missing_required": [],
  "questions": [],
  "notes": []
}

ADDITIONAL RULES:
- If the user asks to create an item, the intent should be "create_item".
- Confidence must be between 0 and 1.
- If a selected category is provided, suggested_category_id must match it.
- If no category is clear, keep suggested_category_id null and suggested_category_name empty.`

	return instructions
}

func buildCategoryPropertyInstructions(basePrompt string, allowWebSearch bool, locale string, provider string) string {
	languageInstruction := humanReadableOutputLanguageInstruction(locale)

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultCategoryPropertyPromptTemplateForProvider(provider)
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps confirm common standards or option sets`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

Return exactly one JSON object and no markdown.

If web_context is present, treat it as trusted read-only web research prepared by item+.

Use this shape:
{
  "confidence": 0.0,
  "needs_confirmation": false,
  "assistant_message": "",
  "questions": [],
  "notes": [],
  "properties": [
    {
      "name": "",
      "property_type": "text",
      "unit": "",
      "required": false,
      "show_in_list": true,
      "display_width": "third",
      "options": []
    }
  ]
}`

	return instructions
}

func buildPropertyEnhancementInstructions(basePrompt string, allowWebSearch bool, locale string, provider string) string {
	languageInstruction := humanReadableOutputLanguageInstruction(locale)

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultPropertyEnhancementPromptTemplateForProvider(provider)
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps confirm common standards or option sets`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

Return exactly one JSON object and no markdown.

If web_context is present, treat it as trusted read-only web research prepared by item+.

Use this shape:
{
  "confidence": 0.0,
  "needs_confirmation": false,
  "assistant_message": "",
  "questions": [],
  "notes": [],
  "property": {
    "name": "",
    "property_type": "text",
    "unit": "",
    "required": false,
    "show_in_list": true,
    "display_width": "third",
    "options": []
  }
}`

	return instructions
}

func buildVendorSuggestionInstructions(basePrompt string, allowWebSearch bool, locale string, provider string) string {
	languageInstruction := humanReadableOutputLanguageInstruction(locale)

	instructions := strings.TrimSpace(basePrompt)
	if instructions == "" {
		instructions = DefaultVendorPromptTemplateForProvider(provider)
	}

	if allowWebSearch {
		instructions += `
- web search is allowed when it helps confirm official company or support details`
	} else {
		instructions += `
- do not rely on web search`
	}

	instructions += `

` + languageInstruction + `

Return exactly one JSON object and no markdown.

If web_context is present, treat it as trusted read-only web research prepared by item+.

Use this shape:
{
  "confidence": 0.0,
  "needs_confirmation": false,
  "assistant_message": "",
  "questions": [],
  "notes": [],
  "vendor": {
    "name": "",
    "website": "",
    "external_logo_url": "",
    "email": "",
    "phone": "",
    "contact_person": "",
    "customer_number": "",
    "account_manager": "",
    "support_email": "",
    "support_phone": "",
    "support_url": "",
    "address": {
      "street": "",
      "house_number": "",
      "zip": "",
      "city": ""
    }
  }
}`

	return instructions
}
