package services

import "testing"

func TestShouldUseWebSearchForChatQuery(t *testing.T) {
	tests := []struct {
		name  string
		query string
		want  bool
	}{
		{name: "greeting", query: "Hey Buddy", want: false},
		{name: "thanks", query: "Danke dir", want: false},
		{name: "app question", query: "Was kann ich hier machen?", want: false},
		{name: "explicit search", query: "Such bitte online nach dem aktuellen Preis", want: true},
		{name: "current fact", query: "Was ist aktuell die neueste Version?", want: true},
		{name: "time sensitive question", query: "Wann spielt Deutschland bei der WM das erste Mal?", want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := shouldUseWebSearchForChatQuery(tt.query); got != tt.want {
				t.Fatalf("shouldUseWebSearchForChatQuery(%q) = %v, want %v", tt.query, got, tt.want)
			}
		})
	}
}
