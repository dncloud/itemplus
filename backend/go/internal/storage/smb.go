package storage

import (
	"context"
	"fmt"
	"net"
	"path"
	"strings"
	"time"

	"github.com/hirochachacha/go-smb2"
)

type SMBSourceConfig struct {
	Host      string
	Port      int
	Username  string
	Password  string
	ShareName string
	BasePath  string
}

type SMBFileStream struct {
	file    *smb2.File
	share   *smb2.Share
	session *smb2.Session
	conn    net.Conn
	Size    int64
	ModTime time.Time
}

func (s *SMBFileStream) Read(p []byte) (int, error) {
	return s.file.Read(p)
}

func (s *SMBFileStream) Seek(offset int64, whence int) (int64, error) {
	return s.file.Seek(offset, whence)
}

func (s *SMBFileStream) Close() error {
	var firstErr error
	if s.file != nil {
		if err := s.file.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if s.share != nil {
		if err := s.share.Umount(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if s.session != nil {
		if err := s.session.Logoff(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if s.conn != nil {
		if err := s.conn.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func ResolveSMBPath(basePath, attachmentPath string) (string, error) {
	base := normalizeSMBBasePath(basePath)
	if base == "" {
		base = "/"
	}

	raw := strings.TrimSpace(strings.ReplaceAll(attachmentPath, "\\", "/"))
	if raw == "" {
		return "", fmt.Errorf("empty SMB attachment path")
	}

	var resolved string
	if strings.HasPrefix(raw, "/") {
		resolved = path.Clean(raw)
	} else {
		resolved = path.Clean(path.Join(base, raw))
	}

	if resolved == "." || !strings.HasPrefix(resolved, "/") {
		return "", fmt.Errorf("invalid SMB attachment path")
	}
	if base != "/" && resolved != base && !strings.HasPrefix(resolved, base+"/") {
		return "", fmt.Errorf("SMB attachment path escapes base path")
	}

	return strings.TrimPrefix(resolved, "/"), nil
}

func OpenSMBFileStream(ctx context.Context, source SMBSourceConfig, attachmentPath string) (*SMBFileStream, error) {
	resolvedPath, err := ResolveSMBPath(source.BasePath, attachmentPath)
	if err != nil {
		return nil, err
	}

	share, session, conn, err := connectSMB(ctx, source)
	if err != nil {
		return nil, err
	}

	file, err := share.WithContext(ctx).Open(resolvedPath)
	if err != nil {
		_ = share.Umount()
		_ = session.Logoff()
		_ = conn.Close()
		return nil, fmt.Errorf("open SMB file: %w", err)
	}

	size := int64(-1)
	modTime := time.Time{}
	if stat, err := file.Stat(); err == nil {
		size = stat.Size()
		modTime = stat.ModTime()
	}

	return &SMBFileStream{
		file:    file,
		share:   share,
		session: session,
		conn:    conn,
		Size:    size,
		ModTime: modTime,
	}, nil
}

func ListSMBDirectory(ctx context.Context, source SMBSourceConfig, attachmentPath string) ([]SFTPDirectoryEntry, error) {
	relativeDir, err := ResolveSMBDirectoryPath(source.BasePath, attachmentPath)
	if err != nil {
		return nil, err
	}

	share, session, conn, err := connectSMB(ctx, source)
	if err != nil {
		return nil, err
	}
	defer share.Umount()
	defer session.Logoff()
	defer conn.Close()

	entries, err := share.WithContext(ctx).ReadDir(relativeDir)
	if err != nil {
		return nil, fmt.Errorf("read SMB directory: %w", err)
	}

	base := normalizeSMBBasePath(source.BasePath)
	if base == "" {
		base = "/"
	}

	items := make([]SFTPDirectoryEntry, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if name == "." || name == ".." {
			continue
		}
		fullPath := path.Join("/", relativeDir, name)
		relative := strings.TrimPrefix(fullPath, base)
		relative = strings.TrimPrefix(relative, "/")
		items = append(items, SFTPDirectoryEntry{
			Name:       name,
			Path:       relative,
			IsDir:      entry.IsDir(),
			Size:       entry.Size(),
			ModifiedAt: entry.ModTime().UTC(),
		})
	}

	return items, nil
}

func TestSMBConnection(ctx context.Context, source SMBSourceConfig) error {
	share, session, conn, err := connectSMB(ctx, source)
	if err != nil {
		return err
	}
	defer share.Umount()
	defer session.Logoff()
	defer conn.Close()

	relativeDir, err := ResolveSMBDirectoryPath(source.BasePath, "")
	if err != nil {
		return err
	}
	if _, err := share.WithContext(ctx).ReadDir(relativeDir); err != nil {
		return fmt.Errorf("read SMB base path: %w", err)
	}
	return nil
}

func ResolveSMBDirectoryPath(basePath, dirPath string) (string, error) {
	base := normalizeSMBBasePath(basePath)
	if base == "" {
		base = "/"
	}

	raw := strings.TrimSpace(strings.ReplaceAll(dirPath, "\\", "/"))
	if raw == "" {
		if base == "/" {
			return ".", nil
		}
		return strings.TrimPrefix(base, "/"), nil
	}

	var resolved string
	if strings.HasPrefix(raw, "/") {
		resolved = path.Clean(raw)
	} else {
		resolved = path.Clean(path.Join(base, raw))
	}

	if resolved == "." || !strings.HasPrefix(resolved, "/") {
		return "", fmt.Errorf("invalid SMB directory path")
	}
	if base != "/" && resolved != base && !strings.HasPrefix(resolved, base+"/") {
		return "", fmt.Errorf("SMB directory path escapes base path")
	}
	if resolved == "/" {
		return ".", nil
	}
	return strings.TrimPrefix(resolved, "/"), nil
}

func normalizeSMBBasePath(raw string) string {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	if raw == "" {
		return "/"
	}
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	return path.Clean(raw)
}

func connectSMB(ctx context.Context, source SMBSourceConfig) (*smb2.Share, *smb2.Session, net.Conn, error) {
	host := strings.TrimSpace(source.Host)
	if host == "" {
		return nil, nil, nil, fmt.Errorf("missing SMB host")
	}
	if source.Port < 1 || source.Port > 65535 {
		return nil, nil, nil, fmt.Errorf("invalid SMB port")
	}
	if strings.TrimSpace(source.Username) == "" {
		return nil, nil, nil, fmt.Errorf("missing SMB username")
	}
	if strings.TrimSpace(source.Password) == "" {
		return nil, nil, nil, fmt.Errorf("missing SMB password")
	}
	if strings.TrimSpace(source.ShareName) == "" {
		return nil, nil, nil, fmt.Errorf("missing SMB share name")
	}

	address := fmt.Sprintf("%s:%d", host, source.Port)
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("dial SMB source: %w", err)
	}

	session, err := (&smb2.Dialer{
		Initiator: &smb2.NTLMInitiator{
			User:     source.Username,
			Password: source.Password,
		},
	}).DialContext(ctx, conn)
	if err != nil {
		_ = conn.Close()
		return nil, nil, nil, fmt.Errorf("handshake SMB source: %w", err)
	}

	share, err := session.Mount(source.ShareName)
	if err != nil {
		_ = session.Logoff()
		_ = conn.Close()
		return nil, nil, nil, fmt.Errorf("mount SMB share: %w", err)
	}

	return share, session, conn, nil
}
