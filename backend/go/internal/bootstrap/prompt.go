package bootstrap

import (
	"errors"
	"strings"
	"sync"
	"time"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

// The questions of the setup, drawn one at a time: a box with the question
// in its upper edge, the answer inside, a hint below. An answered question
// stays on the screen in grey, so the terminal shows the whole way so far.

type promptStyles struct {
	accent lipgloss.Style
	dim    lipgloss.Style
	bold   lipgloss.Style
	warn   lipgloss.Style
	ok     lipgloss.Style
	bad    lipgloss.Style
}

// The indigo of the web app, in a shade that is readable on dark and on
// light terminals; everything else uses the terminal's own colours. The
// terminal is not asked for its background: not every one answers.
var ui = sync.OnceValue(func() promptStyles {
	return promptStyles{
		accent: lipgloss.NewStyle().Foreground(lipgloss.Color("#6366f1")),
		dim:    lipgloss.NewStyle().Foreground(lipgloss.Color("8")),
		bold:   lipgloss.NewStyle().Bold(true),
		warn:   lipgloss.NewStyle().Foreground(lipgloss.Color("3")),
		ok:     lipgloss.NewStyle().Foreground(lipgloss.Color("2")),
		bad:    lipgloss.NewStyle().Foreground(lipgloss.Color("1")),
	}
})

// Width of the terminal as the last question saw it; texts printed between
// two questions are wrapped to it.
var termWidth = 80

// innerWidth is the room for text inside a box.
func innerWidth() int {
	return min(max(termWidth-6, 20), 72)
}

func cutText(text string, width int) string {
	if lipgloss.Width(text) <= width {
		return text
	}
	runes := []rune(text)
	for len(runes) > 0 && lipgloss.Width(string(runes))+1 > width {
		runes = runes[:len(runes)-1]
	}
	return string(runes) + "…"
}

// wrapText breaks plain text at spaces; line breaks in the text are kept.
func wrapText(text string, width int) []string {
	lines := []string{}
	for _, paragraph := range strings.Split(text, "\n") {
		indent := paragraph[:len(paragraph)-len(strings.TrimLeft(paragraph, " "))]
		line := ""
		for _, word := range strings.Fields(paragraph) {
			// A word longer than a line, such as a path, is cut into lines.
			for lipgloss.Width(word) > width {
				if line != "" {
					lines = append(lines, line)
					line = ""
				}
				runes := []rune(word)
				cut := len(runes)
				for lipgloss.Width(string(runes[:cut])) > width {
					cut--
				}
				lines = append(lines, string(runes[:cut]))
				word = string(runes[cut:])
			}
			switch {
			case line == "":
				line = indent + word
			case lipgloss.Width(line)+1+lipgloss.Width(word) > width:
				lines = append(lines, line)
				line = indent + word
			default:
				line += " " + word
			}
		}
		lines = append(lines, line)
	}
	return lines
}

// renderBox draws lines in a frame with the title in its upper edge.
func renderBox(title string, body []string, border, titleStyle lipgloss.Style) string {
	inner := innerWidth()
	var out strings.Builder
	if title == "" {
		out.WriteString(border.Render(" ┌" + strings.Repeat("─", inner+2) + "┐"))
	} else {
		title = cutText(title, inner-1)
		out.WriteString(border.Render(" ┌ ") + titleStyle.Render(title) + border.Render(" "+strings.Repeat("─", inner-lipgloss.Width(title))+"┐"))
	}
	out.WriteString("\n")
	for _, line := range body {
		out.WriteString(border.Render(" │ ") + line + strings.Repeat(" ", max(0, inner-lipgloss.Width(line))) + border.Render(" │") + "\n")
	}
	out.WriteString(border.Render(" └" + strings.Repeat("─", inner+2) + "┘"))
	return out.String()
}

func indentLines(lines []string, style lipgloss.Style) string {
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		out = append(out, "  "+style.Render(line))
	}
	return strings.Join(out, "\n")
}

type promptKind int

const (
	promptText promptKind = iota
	promptSelect
	promptConfirm
)

type promptState int

const (
	promptActive promptState = iota
	promptDone
	promptCancelled
)

type choice struct {
	label string
	value string
}

type prompt struct {
	kind  promptKind
	state promptState
	title string
	hint  string
	keys  string

	input    textinput.Model
	password bool
	validate func(string) error
	problem  string

	choices []choice
	cursor  int
}

func (p *prompt) Init() tea.Cmd {
	if p.kind == promptText {
		return p.input.Focus()
	}
	return nil
}

func (p *prompt) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		termWidth = msg.Width
		p.input.SetWidth(innerWidth() - 1)
		return p, nil
	case tea.KeyPressMsg:
		key := msg.String()
		if key == "ctrl+c" {
			p.state = promptCancelled
			return p, tea.Quit
		}
		switch p.kind {
		case promptText:
			if key == "enter" {
				if p.validate != nil {
					if err := p.validate(p.input.Value()); err != nil {
						p.problem = err.Error()
						return p, nil
					}
				}
				p.state = promptDone
				return p, tea.Quit
			}
			p.problem = ""
		case promptSelect:
			switch key {
			case "up", "k", "shift+tab":
				p.cursor = (p.cursor + len(p.choices) - 1) % len(p.choices)
			case "down", "j", "tab":
				p.cursor = (p.cursor + 1) % len(p.choices)
			case "enter":
				p.state = promptDone
				return p, tea.Quit
			}
			return p, nil
		case promptConfirm:
			switch key {
			case "left", "right", "up", "down", "tab", "shift+tab", "h", "l":
				p.cursor = 1 - p.cursor
			case "y", "j":
				p.cursor = 0
			case "n":
				p.cursor = 1
			case "enter":
				p.state = promptDone
				return p, tea.Quit
			}
			return p, nil
		}
	}
	if p.kind == promptText {
		var cmd tea.Cmd
		p.input, cmd = p.input.Update(msg)
		return p, cmd
	}
	return p, nil
}

func (p *prompt) answer() string {
	if p.kind != promptText {
		return p.choices[p.cursor].label
	}
	value := strings.TrimSpace(p.input.Value())
	switch {
	case value == "":
		return ui().dim.Render("–")
	case p.password:
		return "••••••••"
	}
	return value
}

func (p *prompt) View() tea.View {
	s := ui()
	inner := innerWidth()

	if p.state != promptActive {
		border, title := s.dim, s.dim
		lines := wrapText(p.answer(), inner)
		if p.state == promptCancelled {
			border = s.bad
			for i := range lines {
				lines[i] = s.dim.Strikethrough(true).Render(lines[i])
			}
		}
		return tea.NewView(renderBox(p.title, lines, border, title) + "\n\n")
	}

	body := []string{}
	switch p.kind {
	case promptText:
		body = append(body, p.input.View())
	case promptSelect:
		for i, option := range p.choices {
			for n, line := range wrapText(option.label, inner-4) {
				switch {
				case i == p.cursor && n == 0:
					body = append(body, s.accent.Render("› ● ")+line)
				case i == p.cursor:
					body = append(body, "    "+line)
				case n == 0:
					body = append(body, s.dim.Render("  ○ "+line))
				default:
					body = append(body, s.dim.Render("    "+line))
				}
			}
		}
	case promptConfirm:
		parts := make([]string, 0, 2)
		for i, option := range p.choices {
			if i == p.cursor {
				parts = append(parts, s.accent.Render("● ")+option.label)
			} else {
				parts = append(parts, s.dim.Render("○ "+option.label))
			}
		}
		body = append(body, strings.Join(parts, s.dim.Render("  /  ")))
	}

	border := s.dim
	if p.problem != "" {
		border = s.warn
	}
	out := renderBox(p.title, body, border, s.accent) + "\n"
	if p.problem != "" {
		out += indentLines(wrapText("⚠ "+p.problem, inner+2), s.warn) + "\n"
	} else if p.hint != "" {
		out += indentLines(wrapText(p.hint, inner+2), s.dim) + "\n"
	}
	if p.keys != "" {
		out += indentLines([]string{p.keys}, s.dim) + "\n"
	}
	return tea.NewView(out + "\n")
}

// run shows the question until it is answered. Ctrl+C cancels the setup.
func (p *prompt) run() error {
	if _, err := tea.NewProgram(p).Run(); err != nil {
		if errors.Is(err, tea.ErrInterrupted) {
			return errSetupCancelled
		}
		return err
	}
	if p.state != promptDone {
		return errSetupCancelled
	}
	return nil
}

// asker asks in one language and explains the keys once, at the first
// question of each kind.
type asker struct {
	l             setupLang
	selectShown   bool
	confirmShown  bool
	languageKnown bool
}

func (a *asker) newInput(title, hint, placeholder string, value *string, validate func(string) error) *prompt {
	input := textinput.New()
	input.Prompt = ""
	input.Placeholder = placeholder
	input.EchoCharacter = '•'
	styles := textinput.DefaultDarkStyles()
	styles.Focused.Placeholder = ui().dim
	styles.Focused.Text = lipgloss.NewStyle()
	input.SetStyles(styles)
	input.SetWidth(innerWidth() - 1)
	input.SetValue(*value)
	input.CursorEnd()
	return &prompt{kind: promptText, title: title, hint: hint, input: input, validate: validate}
}

func (a *asker) text(title, hint, placeholder string, value *string, validate func(string) error) error {
	p := a.newInput(title, hint, placeholder, value, validate)
	if err := p.run(); err != nil {
		return err
	}
	*value = strings.TrimSpace(p.input.Value())
	return nil
}

// password hides what is typed, and does not show it afterwards either.
func (a *asker) password(title, hint string, value *string) error {
	p := a.newInput(title, hint, "", value, nil)
	p.password = true
	p.input.EchoMode = textinput.EchoPassword
	if err := p.run(); err != nil {
		return err
	}
	*value = p.input.Value()
	return nil
}

func (a *asker) selectOne(title, hint string, value *string, choices ...choice) error {
	p := &prompt{kind: promptSelect, title: title, hint: hint, choices: choices}
	for i, option := range choices {
		if option.value == *value {
			p.cursor = i
		}
	}
	if !a.selectShown {
		a.selectShown = true
		if a.languageKnown {
			p.keys = a.l.tx("keys.select")
		} else {
			p.keys = "↑/↓ · Enter"
		}
	}
	if err := p.run(); err != nil {
		return err
	}
	*value = choices[p.cursor].value
	return nil
}

func (a *asker) confirm(title, hint string, value *bool) error {
	p := &prompt{kind: promptConfirm, title: title, hint: hint, choices: []choice{{label: a.l.tx("yes")}, {label: a.l.tx("no")}}}
	if !*value {
		p.cursor = 1
	}
	if !a.confirmShown {
		a.confirmShown = true
		p.keys = a.l.tx("keys.confirm")
	}
	if err := p.run(); err != nil {
		return err
	}
	*value = p.cursor == 0
	return nil
}

// spinner shows that something is being tried and waits for it.
type spinner struct {
	label string
	work  func() error
	frame int
	done  bool
	err   error
}

type spinnerTick struct{}
type spinnerDone struct{ err error }

var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

func (s *spinner) tick() tea.Cmd {
	return tea.Tick(80*time.Millisecond, func(time.Time) tea.Msg { return spinnerTick{} })
}

func (s *spinner) Init() tea.Cmd {
	return tea.Batch(s.tick(), func() tea.Msg { return spinnerDone{err: s.work()} })
}

func (s *spinner) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case spinnerTick:
		s.frame = (s.frame + 1) % len(spinnerFrames)
		return s, s.tick()
	case spinnerDone:
		s.done, s.err = true, msg.err
		return s, tea.Quit
	}
	return s, nil
}

func (s *spinner) View() tea.View {
	if s.done {
		return tea.NewView("")
	}
	return tea.NewView("  " + ui().accent.Render(spinnerFrames[s.frame]) + " " + s.label + "\n")
}

func withSpinner(label string, work func() error) error {
	s := &spinner{label: label, work: work}
	if _, err := tea.NewProgram(s).Run(); err != nil {
		if errors.Is(err, tea.ErrInterrupted) {
			return errSetupCancelled
		}
		return err
	}
	return s.err
}

// What is printed between the questions.

// printHeading starts a part of the setup: where one is, and what it is about.
func printHeading(step, title, text string) {
	s := ui()
	line := "  " + s.accent.Bold(true).Render(title)
	if step != "" {
		line += s.dim.Render("  ·  " + step)
	}
	lipgloss.Println(line)
	if text != "" {
		lipgloss.Println(indentLines(wrapText(text, innerWidth()+2), s.dim))
	}
	lipgloss.Println()
}

func printLine(mark string, style lipgloss.Style, text string) {
	lines := wrapText(text, innerWidth())
	for i, line := range lines {
		if i == 0 {
			lipgloss.Println("  " + style.Render(mark) + " " + line)
		} else {
			lipgloss.Println("    " + line)
		}
	}
}

func printBox(title string, text string, border, titleStyle lipgloss.Style) {
	lipgloss.Println(renderBox(title, wrapText(text, innerWidth()), border, titleStyle))
	lipgloss.Println()
}
