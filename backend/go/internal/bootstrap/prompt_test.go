package bootstrap

import (
	"errors"
	"strings"
	"testing"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

// Every line of a box is equally wide, so the right edge is straight, and
// nothing is lost when a text has to be broken.
func TestBoxLinesHaveOneWidthAndKeepTheText(t *testing.T) {
	termWidth = 60
	defer func() { termWidth = 80 }()

	path := "/a/very/long/path/that/does/not/fit/into/one/line/of/the/box/itemplus.conf"
	rows := []summaryRow{{"Erreichbar:", "nur auf diesem Rechner"}, {"Gespeichert in:", path}}
	body := layoutRows(rows, innerWidth(), lipgloss.NewStyle())
	box := renderBox("Zusammenfassung", body, lipgloss.NewStyle(), lipgloss.NewStyle())

	lines := strings.Split(box, "\n")
	for _, line := range lines {
		if lipgloss.Width(line) != lipgloss.Width(lines[0]) {
			t.Fatalf("line %q is %d wide, the first one %d", line, lipgloss.Width(line), lipgloss.Width(lines[0]))
		}
	}
	if lipgloss.Width(lines[0]) > termWidth {
		t.Fatalf("the box is %d wide in a terminal of %d", lipgloss.Width(lines[0]), termWidth)
	}
	joined := ""
	for _, line := range body {
		joined += strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "Gespeichert in:"))
	}
	if !strings.Contains(joined, path) {
		t.Fatalf("the path was not kept whole: %q", joined)
	}

	if got := wrapText("  1. eins zwei drei vier", 12); got[0] != "  1. eins" || !strings.HasPrefix(got[1], "  ") {
		t.Fatalf("an indented line should stay indented when it is broken: %q", got)
	}
	if got := cutText("Eine sehr lange Überschrift", 10); lipgloss.Width(got) > 10 || !strings.HasSuffix(got, "…") {
		t.Fatalf("cut title: %q", got)
	}
}

// A question keeps its answer: the keys move the choice, a wrong entry is
// refused with its reason, and a password is never drawn.
func TestPromptsAnswerToKeys(t *testing.T) {
	press := func(p *prompt, keys ...string) {
		for _, key := range keys {
			msg := tea.KeyPressMsg{}
			switch key {
			case "enter":
				msg.Code = tea.KeyEnter
			case "down":
				msg.Code = tea.KeyDown
			case "left":
				msg.Code = tea.KeyLeft
			default:
				msg.Code, msg.Text = []rune(key)[0], key
			}
			p.Update(msg)
		}
	}

	sel := &prompt{kind: promptSelect, title: "Wahl", choices: []choice{{"Eins", "1"}, {"Zwei", "2"}, {"Drei", "3"}}}
	press(sel, "down", "down", "down", "down", "enter")
	if sel.state != promptDone || sel.choices[sel.cursor].value != "2" {
		t.Fatalf("select: state %v, cursor %d", sel.state, sel.cursor)
	}

	yesNo := &prompt{kind: promptConfirm, title: "Ja?", choices: []choice{{label: "Ja"}, {label: "Nein"}}}
	press(yesNo, "left", "enter")
	if yesNo.cursor != 1 {
		t.Fatalf("confirm should have moved to no, cursor %d", yesNo.cursor)
	}

	a := &asker{languageKnown: true}
	value := ""
	text := a.newInput("Name", "", "", &value, func(v string) error {
		if v == "" {
			return errors.New("fehlt")
		}
		return nil
	})
	text.input.Focus()
	press(text, "enter")
	if text.state != promptActive || text.problem != "fehlt" {
		t.Fatalf("an empty required answer should be refused: state %v, problem %q", text.state, text.problem)
	}
	if !strings.Contains(text.View().Content, "fehlt") {
		t.Fatal("the reason should be shown under the box")
	}
	press(text, "A", "b", "enter")
	if text.state != promptDone || text.input.Value() != "Ab" {
		t.Fatalf("text: state %v, value %q", text.state, text.input.Value())
	}

	secret := "geheim-123"
	pass := a.newInput("Passwort", "", "", &secret, nil)
	pass.password = true
	pass.input.EchoMode = textinput.EchoPassword
	pass.input.Focus()
	if strings.Contains(pass.View().Content, "geheim") {
		t.Fatal("the password is drawn while it is typed")
	}
	press(pass, "enter")
	if strings.Contains(pass.View().Content, "geheim") {
		t.Fatal("the password is drawn after it was entered")
	}
}
