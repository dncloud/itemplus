package storage

import (
	"context"
	"errors"
	"fmt"
	"net"
	"path"
	"strings"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type SFTPSourceConfig struct {
	Host         string
	Port         int
	Username     string
	AuthType     string
	Password     string
	PrivateKey   string
	KnownHostKey string
	BasePath     string
}

type SFTPFileStream struct {
	file      *sftp.File
	sftp      *sftp.Client
	sshClient *ssh.Client
	Size      int64
	ModTime   time.Time
}

type SFTPHostKeyInfo struct {
	Algorithm         string
	FingerprintSHA256 string
	AuthorizedKey     string
}

type SFTPDirectoryEntry struct {
	Name       string
	Path       string
	IsDir      bool
	Size       int64
	ModifiedAt time.Time
}

func (s *SFTPFileStream) Read(p []byte) (int, error) {
	return s.file.Read(p)
}

func (s *SFTPFileStream) Seek(offset int64, whence int) (int64, error) {
	return s.file.Seek(offset, whence)
}

func (s *SFTPFileStream) Close() error {
	var firstErr error
	if s.file != nil {
		if err := s.file.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if s.sftp != nil {
		if err := s.sftp.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	if s.sshClient != nil {
		if err := s.sshClient.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func ResolveSFTPPath(basePath, attachmentPath string) (string, error) {
	base := normalizeSFTPBasePath(basePath)
	if base == "" {
		return "", fmt.Errorf("missing SFTP base path")
	}

	raw := strings.TrimSpace(strings.ReplaceAll(attachmentPath, "\\", "/"))
	if raw == "" {
		return "", fmt.Errorf("empty SFTP attachment path")
	}

	var resolved string
	if strings.HasPrefix(raw, "/") {
		resolved = path.Clean(raw)
	} else {
		resolved = path.Clean(path.Join(base, raw))
	}

	if resolved == "." || !strings.HasPrefix(resolved, "/") {
		return "", fmt.Errorf("invalid SFTP attachment path")
	}
	if base != "/" && resolved != base && !strings.HasPrefix(resolved, base+"/") {
		return "", fmt.Errorf("SFTP attachment path escapes base path")
	}
	return resolved, nil
}

func OpenSFTPFileStream(ctx context.Context, source SFTPSourceConfig, attachmentPath string) (*SFTPFileStream, error) {
	resolvedPath, err := ResolveSFTPPath(source.BasePath, attachmentPath)
	if err != nil {
		return nil, err
	}

	sftpClient, sshClient, err := connectSFTP(ctx, source)
	if err != nil {
		return nil, err
	}

	file, err := sftpClient.Open(resolvedPath)
	if err != nil {
		_ = sftpClient.Close()
		_ = sshClient.Close()
		return nil, fmt.Errorf("open SFTP file: %w", err)
	}

	size := int64(-1)
	modTime := time.Time{}
	if stat, err := file.Stat(); err == nil {
		size = stat.Size()
		modTime = stat.ModTime()
	}

	return &SFTPFileStream{
		file:      file,
		sftp:      sftpClient,
		sshClient: sshClient,
		Size:      size,
		ModTime:   modTime,
	}, nil
}

func ListSFTPDirectory(ctx context.Context, source SFTPSourceConfig, attachmentPath string) ([]SFTPDirectoryEntry, error) {
	resolvedPath, err := resolveSFTPDirectoryPath(source.BasePath, attachmentPath)
	if err != nil {
		return nil, err
	}

	sftpClient, sshClient, err := connectSFTP(ctx, source)
	if err != nil {
		return nil, err
	}
	defer sftpClient.Close()
	defer sshClient.Close()

	entries, err := sftpClient.ReadDir(resolvedPath)
	if err != nil {
		return nil, fmt.Errorf("read SFTP directory: %w", err)
	}

	base := normalizeSFTPBasePath(source.BasePath)
	items := make([]SFTPDirectoryEntry, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if name == "." || name == ".." {
			continue
		}
		fullPath := path.Join(resolvedPath, name)
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

func TestSFTPConnection(ctx context.Context, source SFTPSourceConfig) error {
	sftpClient, sshClient, err := connectSFTP(ctx, source)
	if err != nil {
		return err
	}
	defer sftpClient.Close()
	defer sshClient.Close()

	basePath := normalizeSFTPBasePath(source.BasePath)
	if basePath == "" {
		return fmt.Errorf("missing SFTP base path")
	}
	if _, err := sftpClient.Stat(basePath); err != nil {
		return fmt.Errorf("stat SFTP base path: %w", err)
	}
	return nil
}

func FetchSFTPHostKey(ctx context.Context, host string, port int) (*SFTPHostKeyInfo, error) {
	if strings.TrimSpace(host) == "" {
		return nil, fmt.Errorf("missing SFTP host")
	}
	if port < 1 || port > 65535 {
		return nil, fmt.Errorf("invalid SFTP port")
	}

	var captured ssh.PublicKey
	var stopAfterKey = errors.New("host key captured")

	cfg := &ssh.ClientConfig{
		User: "itemplus",
		Auth: []ssh.AuthMethod{ssh.Password("")},
		HostKeyAlgorithms: []string{
			ssh.KeyAlgoED25519,
			ssh.KeyAlgoECDSA256,
			ssh.KeyAlgoECDSA384,
			ssh.KeyAlgoECDSA521,
			ssh.KeyAlgoRSA,
			ssh.KeyAlgoDSA,
		},
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			captured = key
			return stopAfterKey
		},
		Timeout: 10 * time.Second,
	}

	address := fmt.Sprintf("%s:%d", host, port)
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return nil, fmt.Errorf("dial SFTP source: %w", err)
	}
	defer conn.Close()

	_, _, _, err = ssh.NewClientConn(conn, address, cfg)
	if err != nil && !errors.Is(err, stopAfterKey) && captured == nil {
		return nil, fmt.Errorf("fetch SFTP host key: %w", err)
	}
	if captured == nil {
		return nil, fmt.Errorf("SFTP host key not received")
	}

	return &SFTPHostKeyInfo{
		Algorithm:         captured.Type(),
		FingerprintSHA256: ssh.FingerprintSHA256(captured),
		AuthorizedKey:     strings.TrimSpace(string(ssh.MarshalAuthorizedKey(captured))),
	}, nil
}

func buildSFTPAuthMethod(source SFTPSourceConfig) (ssh.AuthMethod, error) {
	switch source.AuthType {
	case "password":
		if strings.TrimSpace(source.Password) == "" {
			return nil, fmt.Errorf("missing SFTP password")
		}
		return ssh.Password(source.Password), nil
	case "ssh_key":
		if strings.TrimSpace(source.PrivateKey) == "" {
			return nil, fmt.Errorf("missing SFTP private key")
		}
		signer, err := ssh.ParsePrivateKey([]byte(source.PrivateKey))
		if err != nil {
			return nil, fmt.Errorf("parse SFTP private key: %w", err)
		}
		return ssh.PublicKeys(signer), nil
	default:
		return nil, fmt.Errorf("unsupported SFTP auth type")
	}
}

func normalizeSFTPBasePath(raw string) string {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	if raw == "" {
		return ""
	}
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	return path.Clean(raw)
}

func resolveSFTPDirectoryPath(basePath, dirPath string) (string, error) {
	base := normalizeSFTPBasePath(basePath)
	if base == "" {
		return "", fmt.Errorf("missing SFTP base path")
	}

	raw := strings.TrimSpace(strings.ReplaceAll(dirPath, "\\", "/"))
	if raw == "" || raw == "." || raw == "/" {
		return base, nil
	}

	var resolved string
	if strings.HasPrefix(raw, "/") {
		resolved = path.Clean(raw)
	} else {
		resolved = path.Clean(path.Join(base, raw))
	}

	if resolved == "." || !strings.HasPrefix(resolved, "/") {
		return "", fmt.Errorf("invalid SFTP directory path")
	}
	if base != "/" && resolved != base && !strings.HasPrefix(resolved, base+"/") {
		return "", fmt.Errorf("SFTP directory path escapes base path")
	}
	return resolved, nil
}

func connectSFTP(ctx context.Context, source SFTPSourceConfig) (*sftp.Client, *ssh.Client, error) {
	expectedKey, _, _, _, err := ssh.ParseAuthorizedKey([]byte(strings.TrimSpace(source.KnownHostKey)))
	if err != nil {
		return nil, nil, fmt.Errorf("parse known_host_key: %w", err)
	}

	authMethod, err := buildSFTPAuthMethod(source)
	if err != nil {
		return nil, nil, err
	}

	cfg := &ssh.ClientConfig{
		User:              source.Username,
		Auth:              []ssh.AuthMethod{authMethod},
		HostKeyAlgorithms: []string{expectedKey.Type()},
		HostKeyCallback:   ssh.FixedHostKey(expectedKey),
		Timeout:           10 * time.Second,
	}

	address := fmt.Sprintf("%s:%d", source.Host, source.Port)
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return nil, nil, fmt.Errorf("dial SFTP source: %w", err)
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(conn, address, cfg)
	if err != nil {
		_ = conn.Close()
		return nil, nil, fmt.Errorf("handshake SFTP source: %w", err)
	}
	sshClient := ssh.NewClient(sshConn, chans, reqs)

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		_ = sshClient.Close()
		return nil, nil, fmt.Errorf("open SFTP client: %w", err)
	}
	return sftpClient, sshClient, nil
}
