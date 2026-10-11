package ai

import (
	"strings"
	"testing"
)

// every prompt the server sends, with the default text of a fresh profile
func allInstructions(provider string) map[string]string {
	return map[string]string{
		"chat":          buildChatInstructions("", true, "de", provider),
		"identify":      buildParseInstructions("", true, "de", true, provider),
		"parse":         buildParseInstructions("", true, "de", false, provider),
		"category":      buildCategoryPropertyInstructions("", true, "de", provider),
		"property":      buildPropertyEnhancementInstructions("", true, "de", provider),
		"vendor":        buildVendorSuggestionInstructions("", true, "de", provider),
		"custom chat":   buildChatInstructions("Be a pirate.", true, "de", provider),
		"custom parse":  buildParseInstructions("Be a pirate.", true, "de", false, provider),
		"custom vendor": buildVendorSuggestionInstructions("Be a pirate.", true, "de", provider),
	}
}

// Web pages and what people typed into item+ are read, never obeyed, and no
// prompt calls them "trusted" any more. This holds for the default prompts
// and for a profile's own text alike.
func TestEveryPromptTreatsOutsideTextAsMaterial(t *testing.T) {
	for _, provider := range []string{"openai", "ollama"} {
		for name, instructions := range allInstructions(provider) {
			if !strings.Contains(instructions, outsideTextRule) {
				t.Errorf("%s/%s: the rule about outside text is missing", provider, name)
			}
			if strings.Contains(instructions, "trusted read-only web research") || strings.Contains(instructions, "treat app_context as trusted") {
				t.Errorf("%s/%s: still calls outside content trusted", provider, name)
			}
		}
	}
}

// The item prompt says how the value of each property type has to look and
// what the two areas are; that is part of the fixed rules, so a profile's own
// prompt cannot lose it.
func TestItemPromptExplainsValuesAndAreas(t *testing.T) {
	for name, instructions := range map[string]string{
		"default": buildParseInstructions("", false, "en", false, "openai"),
		"custom":  buildParseInstructions("Be a pirate.", false, "en", false, "openai"),
	} {
		for _, want := range []string{
			`date: "YYYY-MM-DD"`,
			"select: exactly one of the property's options",
			"condition: one of new, like_new, very_good, good, acceptable, poor, defective",
			"priority: one of low, medium, high, critical",
			`weight: {"value": n, "unit": "g" | "kg" | "t"}`,
			"archive: things that are used and stored; collection: things that are collected",
			"category_proposal stays null",
			"missing_required lists",
		} {
			if !strings.Contains(instructions, want) {
				t.Errorf("%s item prompt lacks %q", name, want)
			}
		}
	}
}

// What a profile says about tone is said once. Earlier the server appended
// the same sentences again, so editing them in the settings changed nothing.
func TestToneRulesAreNotAppendedASecondTime(t *testing.T) {
	custom := buildParseInstructions("Be a pirate.", false, "en", false, "openai")
	for _, appended := range []string{"must sound conversational", "call yourself Ina", `headings such as "Open questions"`} {
		if strings.Contains(custom, appended) {
			t.Errorf("a custom item prompt still gets %q appended", appended)
		}
	}
	standard := buildParseInstructions("", false, "en", false, "openai")
	if n := strings.Count(standard, "assistant_message"); n > 2 {
		t.Errorf("the default item prompt mentions assistant_message %d times outside the JSON shape and one rule", n)
	}
}

// A profile that still carries an old default, word for word, follows the
// new default; a prompt its owner wrote or changed is left alone.
func TestUneditedOldDefaultsFollowTheNewOnes(t *testing.T) {
	for _, provider := range []string{"openai", "ollama"} {
		oldChat := stock2025ChatPrompt(provider)
		if !strings.Contains(oldChat, "Neuronatic") {
			t.Fatal("the kept old default is not the old text")
		}
		if got := buildChatInstructions(oldChat, false, "en", provider); strings.Contains(got, "Neuronatic") || !strings.Contains(got, DefaultChatPromptTemplateForProvider(provider)) {
			t.Errorf("%s: an unedited old chat prompt was not replaced by the new default", provider)
		}
		if !isStockPrompt("\n  "+stock2025VendorPrompt(provider)+"  \n") || !isStockPrompt("") {
			t.Errorf("%s: old default with surrounding blanks, or an empty prompt, not recognised", provider)
		}
		edited := oldChat + "\n- always answer in rhymes"
		if isStockPrompt(edited) {
			t.Errorf("%s: an edited prompt counts as unedited", provider)
		}
		if got := buildChatInstructions(edited, false, "en", provider); !strings.Contains(got, "always answer in rhymes") {
			t.Errorf("%s: an edited prompt was thrown away", provider)
		}
	}
	for name, text := range map[string]string{
		"chat": DefaultChatPromptTemplateForProvider("openai"), "parse": DefaultParseItemPromptTemplateForProvider("openai"),
		"category": DefaultCategoryPropertyPromptTemplateForProvider("ollama"), "property": DefaultPropertyEnhancementPromptTemplateForProvider("ollama"),
		"vendor": DefaultVendorPromptTemplateForProvider("openai"),
	} {
		if strings.Contains(text, "Neuronatic") || strings.Contains(text, "weather") {
			t.Errorf("new default %s prompt still has the old wording", name)
		}
		if !strings.Contains(text, "You are Ina") || !strings.Contains(text, "archive") {
			t.Errorf("new default %s prompt does not introduce Ina and the app", name)
		}
	}
}
