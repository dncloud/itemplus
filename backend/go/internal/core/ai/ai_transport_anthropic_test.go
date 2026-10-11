package ai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeAnthropic stands in for api.anthropic.com: it records what was sent
// and answers with the replies it was given, one per request.
type fakeAnthropic struct {
	t        *testing.T
	server   *httptest.Server
	requests []map[string]any
	headers  []http.Header
	paths    []string
	replies  []func(w http.ResponseWriter)
}

func newFakeAnthropic(t *testing.T, replies ...func(w http.ResponseWriter)) *fakeAnthropic {
	fake := &fakeAnthropic{t: t, replies: replies}
	fake.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		payload := map[string]any{}
		_ = json.Unmarshal(body, &payload)
		fake.requests = append(fake.requests, payload)
		fake.headers = append(fake.headers, r.Header.Clone())
		fake.paths = append(fake.paths, r.URL.Path)
		if len(fake.requests) > len(fake.replies) {
			t.Errorf("unexpected request %d to %s", len(fake.requests), r.URL.Path)
			http.Error(w, "unexpected", http.StatusInternalServerError)
			return
		}
		fake.replies[len(fake.requests)-1](w)
	}))
	t.Cleanup(fake.server.Close)
	return fake
}

func jsonReply(status int, body string) func(w http.ResponseWriter) {
	return func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("request-id", "req_test")
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}
}

func messageJSON(stopReason, text string) string {
	content := "[]"
	if text != "" {
		encoded, _ := json.Marshal(text)
		content = fmt.Sprintf(`[{"type":"text","text":%s}]`, encoded)
	}
	return fmt.Sprintf(`{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5-5","content":%s,"stop_reason":%q,"stop_sequence":null,"usage":{"input_tokens":100,"output_tokens":20,"cache_creation_input_tokens":0,"cache_read_input_tokens":5,"server_tool_use":{"web_search_requests":2,"web_fetch_requests":0}}}`, content, stopReason)
}

// A plain request: the key goes in Anthropic's own header, the instructions
// are the system prompt, the answer text and the token counts come back.
func TestClaudeRequestAndAnswer(t *testing.T) {
	fake := newFakeAnthropic(t, jsonReply(200, messageJSON("end_turn", `{"ok":true}`)))

	text, transport, usage, err := generateAIText(fake.server.Client(), fake.server.URL, "anthropic", "claude-opus-5-5", " sk-test ", "Be brief.", "Hello", false, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if text != `{"ok":true}` || transport != "anthropic.messages" {
		t.Fatalf("text %q via %q", text, transport)
	}
	if usage.InputTokens != 105 || usage.OutputTokens != 20 || usage.TotalTokens != 125 || usage.WebSearchRequests != 2 {
		t.Fatalf("usage = %+v", usage)
	}

	if fake.paths[0] != "/v1/messages" {
		t.Fatalf("path = %s", fake.paths[0])
	}
	if got := fake.headers[0].Get("X-Api-Key"); got != "sk-test" {
		t.Fatalf("x-api-key = %q", got)
	}
	if fake.headers[0].Get("Authorization") != "" || fake.headers[0].Get("Anthropic-Version") == "" {
		t.Fatalf("headers are not Anthropic's: %v", fake.headers[0])
	}
	request := fake.requests[0]
	if request["model"] != "claude-opus-5-5" || request["max_tokens"] != float64(anthropicMaxTokens) {
		t.Fatalf("model/max_tokens = %v/%v", request["model"], request["max_tokens"])
	}
	if system := fmt.Sprint(request["system"]); !strings.Contains(system, "Be brief.") {
		t.Fatalf("system = %v", request["system"])
	}
	// Nothing the current models reject: no sampling settings, no thinking budget, no tools unasked.
	for _, key := range []string{"temperature", "top_p", "top_k", "thinking", "tools", "tool_choice"} {
		if _, sent := request[key]; sent {
			t.Errorf("request carries %q", key)
		}
	}
}

// With web search allowed the request offers Anthropic's web search tool,
// and a picture is sent as an image block in front of the text.
func TestClaudeWebSearchAndImage(t *testing.T) {
	fake := newFakeAnthropic(t, jsonReply(200, messageJSON("end_turn", "ok")), jsonReply(200, messageJSON("end_turn", "ok")))

	image := &AIImageInput{Data: []byte("fake-png"), MimeType: "image/png"}
	if _, _, _, err := generateAIText(fake.server.Client(), fake.server.URL, "anthropic", "claude-opus-5-5", "key", "sys", "What is this?", true, image, nil, nil); err != nil {
		t.Fatal(err)
	}
	tools := fake.requests[0]["tools"].([]any)
	if tool := tools[0].(map[string]any); tool["type"] != "web_search_20260209" || tool["name"] != "web_search" || tool["max_uses"] != float64(anthropicWebSearchMaxUses) {
		t.Fatalf("tool = %v", tool)
	}
	content := fake.requests[0]["messages"].([]any)[0].(map[string]any)["content"].([]any)
	if first := content[0].(map[string]any); first["type"] != "image" || first["source"].(map[string]any)["media_type"] != "image/png" {
		t.Fatalf("first block = %v", first)
	}
	if last := content[len(content)-1].(map[string]any); last["type"] != "text" || last["text"] != "What is this?" {
		t.Fatalf("last block = %v", last)
	}

	// A model that does not know the current tool gets the basic one.
	if _, _, _, err := generateAIText(fake.server.Client(), fake.server.URL, "anthropic", "claude-haiku-4-5", "key", "sys", "q", true, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if tool := fake.requests[1]["tools"].([]any)[0].(map[string]any); tool["type"] != "web_search_20250305" {
		t.Fatalf("older model got tool %v", tool["type"])
	}

	// A picture type Claude cannot read is refused before anything is sent.
	if _, _, _, err := generateAIText(fake.server.Client(), fake.server.URL, "anthropic", "claude-opus-5-5", "key", "sys", "q", false, &AIImageInput{Data: []byte("x"), MimeType: "image/heic"}, nil, nil); err == nil {
		t.Fatal("a HEIC image was accepted")
	}
	if len(fake.requests) != 2 {
		t.Fatalf("%d requests sent, want 2", len(fake.requests))
	}
}

// A paused turn is continued with what was produced so far; a refusal and a
// rejected key become errors that say what happened.
func TestClaudePauseRefusalAndErrors(t *testing.T) {
	fake := newFakeAnthropic(t,
		jsonReply(200, messageJSON("pause_turn", "first ")),
		jsonReply(200, messageJSON("end_turn", "second")),
	)
	text, _, usage, err := generateAIText(fake.server.Client(), fake.server.URL, "anthropic", "claude-opus-5-5", "key", "sys", "q", true, nil, nil, nil)
	if err != nil || text != "first second" {
		t.Fatalf("text %q, err %v", text, err)
	}
	if usage.OutputTokens != 40 {
		t.Fatalf("usage of both requests is not added up: %+v", usage)
	}
	if messages := fake.requests[1]["messages"].([]any); len(messages) != 2 || messages[1].(map[string]any)["role"] != "assistant" {
		t.Fatalf("the continuation does not carry the paused answer: %v", messages)
	}

	refusal := `{"id":"msg_2","type":"message","role":"assistant","model":"claude-opus-5-5","content":[],"stop_reason":"refusal","stop_details":{"type":"refusal","category":"cyber","explanation":"x"},"usage":{"input_tokens":1,"output_tokens":0}}`
	fake = newFakeAnthropic(t, jsonReply(200, refusal))
	if _, _, _, err := generateAIText(fake.server.Client(), fake.server.URL, "anthropic", "claude-opus-5-5", "key", "sys", "q", false, nil, nil, nil); err == nil || !strings.Contains(err.Error(), "declined") || !strings.Contains(err.Error(), "cyber") {
		t.Fatalf("refusal error = %v", err)
	}

	for status, want := range map[int]string{401: "API key was rejected", 404: "model was not found", 400: "not accepted"} {
		fake = newFakeAnthropic(t, jsonReply(status, `{"type":"error","error":{"type":"some_error","message":"secret detail"}}`))
		_, _, _, err := generateAIText(fake.server.Client(), fake.server.URL, "anthropic", "claude-opus-5-5", "key", "sys", "q", false, nil, nil, nil)
		if err == nil || !strings.Contains(err.Error(), want) || !strings.Contains(err.Error(), "req_test") {
			t.Fatalf("HTTP %d error = %v, want %q and the request id", status, err, want)
		}
	}
}

// The chat receives the text piece by piece.
func TestClaudeStream(t *testing.T) {
	events := []string{
		`event: message_start` + "\n" + `data: {"type":"message_start","message":{"id":"msg_s","type":"message","role":"assistant","model":"claude-opus-5-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":50,"output_tokens":1}}}`,
		`event: content_block_start` + "\n" + `data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
		`event: content_block_delta` + "\n" + `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hal"}}`,
		`event: content_block_delta` + "\n" + `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}`,
		`event: content_block_stop` + "\n" + `data: {"type":"content_block_stop","index":0}`,
		`event: message_delta` + "\n" + `data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":7}}`,
		`event: message_stop` + "\n" + `data: {"type":"message_stop"}`,
	}
	fake := newFakeAnthropic(t, func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, strings.Join(events, "\n\n")+"\n\n")
	})

	var pieces []string
	var usage AIUsage
	err := generateViaChatCompletionsStream(fake.server.Client(), fake.server.URL, "anthropic", "claude-opus-5-5", "key", "sys", "Hi", nil,
		func(delta string) error { pieces = append(pieces, delta); return nil },
		func(next AIUsage) error { usage = next; return nil },
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(pieces, "|") != "Hal|lo" {
		t.Fatalf("pieces = %v", pieces)
	}
	if usage.InputTokens != 50 || usage.OutputTokens != 7 {
		t.Fatalf("usage = %+v", usage)
	}
	if fake.requests[0]["stream"] != true {
		t.Fatal("the request did not ask for a stream")
	}
}

// The settings can test a Claude profile and load its models.
func TestClaudeConnectionTestAndModelList(t *testing.T) {
	fake := newFakeAnthropic(t, jsonReply(200, messageJSON("end_turn", "item+ connection ok")))
	result, err := TestAIConnection(AISettings{Enabled: true, Provider: "anthropic", Model: "claude-opus-5-5", APIKey: "key", BaseURL: fake.server.URL})
	if err != nil || result.Status != "ok" || result.OutputText != "item+ connection ok" || result.Provider != "anthropic" {
		t.Fatalf("result %+v, err %v", result, err)
	}

	fake = newFakeAnthropic(t, jsonReply(200, `{"data":[
		{"id":"claude-haiku-5-5","type":"model","display_name":"Claude Haiku 5.5","created_at":"2026-05-01T00:00:00Z"},
		{"id":"claude-opus-5-5","type":"model","display_name":"Claude Opus 5.5","created_at":"2026-09-01T00:00:00Z"}
	],"has_more":false,"first_id":"claude-haiku-5-5","last_id":"claude-opus-5-5"}`))
	models, err := ListAIModels(AISettings{Provider: "anthropic", APIKey: "key", BaseURL: fake.server.URL})
	if err != nil || len(models) != 2 || models[0].ID != "claude-opus-5-5" || models[1].ID != "claude-haiku-5-5" {
		t.Fatalf("models %+v, err %v", models, err)
	}
	if fake.paths[0] != "/v1/models" {
		t.Fatalf("path = %s", fake.paths[0])
	}

	if _, err := resolveAIConfig(AISettings{Enabled: true, Provider: "anthropic", Model: "claude-opus-5-5"}, 0); err == nil {
		t.Fatal("a Claude profile without a key was accepted")
	}
}
