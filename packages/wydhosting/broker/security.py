"""Trusted Linux primitives. Loaded only from the protected broker release."""
import hashlib
import json
import os
import re
import socket
import stat
import struct

MAX_FRAME = 262144
MAX_POLICY = 4 * 1024 * 1024
RESERVED = {'__proto__', 'prototype', 'constructor'}


class Refused(Exception):
    def __init__(self, code='BROKER.INVALID'):
        self.code = code
        super().__init__('Administrative operation refused')


def require(ok, code='BROKER.INVALID'):
    if not ok:
        raise Refused(code)


def closed(value, keys):
    require(type(value) is dict and set(value) == set(keys))


def identifier(value):
    return type(value) is str and re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value) is not None and value not in RESERVED


def integer(value, low=0, high=9007199254740991):
    return type(value) is int and low <= value <= high


def relative(value):
    require(type(value) is str and 0 < len(value.encode()) <= 256 and '\\' not in value and '\0' not in value and not any(ord(c) < 32 or ord(c) == 127 for c in value))
    parts = value.split('/')
    require(len(parts) <= 32 and all(p not in ('', '.', '..') and not p.startswith('.') and len(p.encode()) <= 255 for p in parts))
    return parts


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result and key not in RESERVED)
        result[key] = value
    return result


def decode(raw, limit=MAX_FRAME):
    require(len(raw) <= limit)
    try:
        result = json.loads(raw.decode('utf-8', 'strict'), object_pairs_hook=pairs,
                            parse_constant=lambda _: (_ for _ in ()).throw(Refused()))
        count = 0
        def walk(value, depth=0):
            nonlocal count
            count += 1
            require(depth <= 32 and count <= 131072)
            if type(value) in (int, float):
                require(integer(value, -9007199254740991))
            elif type(value) is dict:
                for child in value.values():
                    walk(child, depth + 1)
            elif type(value) is list:
                for child in value:
                    walk(child, depth + 1)
            else:
                require(value is None or type(value) in (str, bool))
        walk(result)
        return result
    except (ValueError, UnicodeError, RecursionError):
        raise Refused() from None


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def peercred(sock):
    pid, uid, gid = struct.unpack('3i', sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    require(pid > 0 and uid >= 0 and gid >= 0, 'BROKER.PEER')
    return pid, uid, gid


def read_frame(sock, timeout=10):
    sock.settimeout(timeout)
    data = bytearray()
    # One-byte reads deliberately never consume a following relayed worker frame.
    while len(data) <= MAX_FRAME:
        byte = sock.recv(1)
        require(bool(byte), 'BROKER.CLOSED')
        if byte == b'\n':
            return decode(bytes(data))
        data.extend(byte)
    raise Refused('BROKER.LIMIT')


def write_frame(sock, value):
    data = encode(value)
    require(len(data) <= MAX_FRAME, 'BROKER.LIMIT')
    sock.sendall(data + b'\n')


def open_directory(filename, owners=(0,), protected=True):
    require(type(filename) is str and filename.startswith('/') and filename != '/' and '\\' not in filename)
    parts = filename[1:].split('/')
    require(all(p not in ('', '.', '..') and not any(ord(c) < 32 or ord(c) == 127 for c in p) for p in parts))
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
    try:
        for part in parts:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            os.close(fd)
            fd = child
            info = os.fstat(fd)
            require(info.st_uid in owners and (not protected or info.st_mode & 0o022 == 0), 'BROKER.PATH')
        return fd
    except BaseException:
        os.close(fd)
        raise


def read_file(parent, name, limit=MAX_POLICY, owner=0):
    require('/' not in name and name not in ('', '.', '..'))
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC, dir_fd=parent)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == owner and info.st_nlink == 1 and info.st_mode & 0o022 == 0 and info.st_size <= limit, 'BROKER.PATH')
        data = bytearray()
        while len(data) <= limit:
            chunk = os.read(fd, min(65536, limit + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
        require(len(data) <= limit, 'BROKER.LIMIT')
        return bytes(data)
    finally:
        os.close(fd)


def atomic_file(parent, name, data, mode=0o600, replace=False):
    import secrets
    require('/' not in name and name not in ('', '.', '..'))
    temporary = '.pending-' + secrets.token_hex(16)
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, mode, dir_fd=parent)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if replace:
            os.rename(temporary, name, src_dir_fd=parent, dst_dir_fd=parent)
        else:
            # link() is an atomic no-replace publication on the same filesystem.
            os.link(temporary, name, src_dir_fd=parent, dst_dir_fd=parent, follow_symlinks=False)
            os.unlink(temporary, dir_fd=parent)
        os.fsync(parent)
    except BaseException:
        try:
            os.unlink(temporary, dir_fd=parent)
        except FileNotFoundError:
            pass
        raise


def mkdir_owned(parent, name, uid, gid, mode=0o750):
    require('/' not in name and name not in ('', '.', '..'))
    try:
        os.mkdir(name, mode, dir_fd=parent)
        fresh = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
        try:
            os.fchown(fresh, uid, gid)
            os.fchmod(fresh, mode)
        finally:
            os.close(fresh)
        os.fsync(parent)
    except FileExistsError:
        pass
    fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent)
    info = os.fstat(fd)
    if info.st_uid != uid or info.st_gid != gid or stat.S_IMODE(info.st_mode) != mode:
        os.close(fd)
        raise Refused('BROKER.OWNERSHIP')
    return fd


def stage_tree(source, destination, descriptor, source_uid, gid, owner=0):
    """Both roots are held descriptors; never reopen a customer pathname."""
    closed(descriptor, ('directories', 'files'))
    require(type(descriptor['directories']) is list and type(descriptor['files']) is list)
    require(len(descriptor['directories']) + len(descriptor['files']) <= 8192)
    directories = set(descriptor['directories'])
    require(len(directories) == len(descriptor['directories']))
    files = {}
    total = 0
    for entry in descriptor['files']:
        closed(entry, ('path', 'size', 'sha256'))
        relative(entry['path'])
        require(entry['path'] not in files and integer(entry['size'], 0, 16 * 1024 * 1024) and re.fullmatch('[a-f0-9]{64}', entry['sha256']))
        total += entry['size']
        files[entry['path']] = entry
    require(total <= 128 * 1024 * 1024 and not directories.intersection(files))
    expected = directories | set(files)
    for name in expected:
        relative(name)
        require(name.split('/')[0] in ('content', 'prototypes', 'public', 'wydgit.config.json'))
        require('/' not in name or name.rsplit('/', 1)[0] in directories)
    require({'content', 'prototypes', 'public'}.issubset(directories) and 'wydgit.config.json' in files)
    device = os.fstat(source).st_dev
    seen = set()

    def copy(src, dst, prefix=''):
        names = os.listdir(src)
        # Mutable service data is deliberately excluded, and never copied/overwritten.
        if not prefix:
            names = [n for n in names if n in ('content', 'prototypes', 'public', 'wydgit.config.json')]
        for name in sorted(names):
            rel = prefix + name
            require(rel in expected and rel not in seen, 'BROKER.CONTENT')
            seen.add(rel)
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
            fd = open_relative(src, name, flags)
            try:
                before = os.fstat(fd)
                require(before.st_dev == device and before.st_uid in (0, source_uid), 'BROKER.OWNERSHIP')
                if rel in directories:
                    require(stat.S_ISDIR(before.st_mode), 'BROKER.CONTENT')
                    child = mkdir_owned(dst, name, owner, gid)
                    try:
                        copy(fd, child, rel + '/')
                        os.fchmod(child, 0o550)
                        os.fsync(child)
                    finally:
                        os.close(child)
                else:
                    entry = files[rel]
                    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and before.st_size == entry['size'], 'BROKER.CONTENT')
                    target = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o440, dir_fd=dst)
                    try:
                        digest = hashlib.sha256()
                        copied = 0
                        while True:
                            chunk = os.read(fd, min(65536, entry['size'] + 1 - copied))
                            if not chunk:
                                break
                            copied += len(chunk)
                            require(copied <= entry['size'], 'BROKER.CONTENT')
                            digest.update(chunk)
                            with memoryview(chunk) as view:
                                while view:
                                    written = os.write(target, view)
                                    view = view[written:]
                        require(copied == entry['size'] and digest.hexdigest() == entry['sha256'], 'BROKER.CONTENT')
                        after = os.fstat(fd)
                        require((before.st_ino, before.st_dev, before.st_size, before.st_mtime_ns, before.st_ctime_ns, before.st_nlink) ==
                                (after.st_ino, after.st_dev, after.st_size, after.st_mtime_ns, after.st_ctime_ns, after.st_nlink), 'BROKER.RACE')
                        os.fchown(target, owner, gid)
                        os.fchmod(target, 0o440)
                        os.fsync(target)
                    finally:
                        os.close(target)
            finally:
                os.close(fd)
        os.fsync(dst)
    copy(source, destination)
    require(seen == expected, 'BROKER.CONTENT')


def expose_ingress(directory, uid, gid, pid):
    """Grant provider group access to a held socket inode, never a mutable pathname."""
    fd = os.open('http.sock', os.O_PATH | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=directory)
    try:
        held = os.fstat(fd)
        require(stat.S_ISSOCK(held.st_mode) and held.st_uid == uid and held.st_nlink == 1, 'BROKER.OWNERSHIP')
        inode_path = '/proc/self/fd/' + str(fd)
        test = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        test.settimeout(2)
        try:
            test.connect(inode_path)
            peer = peercred(test)
            require(peer[0] == pid and peer[1] == uid, 'BROKER.PEER')
        finally:
            test.close()
        os.chown(inode_path, -1, gid)
        os.chmod(inode_path, 0o660)
        os.fchown(directory, -1, gid)
        os.fchmod(directory, 0o710)
    finally:
        os.close(fd)


def verify_release(directory, owner=0):
    """Reject mutable or redirected executable closure before any OS operation."""
    count = 0
    device = os.fstat(directory).st_dev
    def walk(fd, depth=0):
        nonlocal count
        require(depth <= 32, 'BROKER.RELEASE')
        for name in os.listdir(fd):
            count += 1
            require(count <= 32768, 'BROKER.RELEASE')
            child = open_relative(fd, name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
            try:
                info = os.fstat(child)
                require(info.st_uid == owner and info.st_dev == device and not info.st_mode & 0o6022, 'BROKER.RELEASE')
                if stat.S_ISDIR(info.st_mode):
                    walk(child, depth+1)
                else:
                    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'BROKER.RELEASE')
            finally:
                os.close(child)
    walk(directory)


def open_relative(parent, name, flags):
    """Linux openat2, no fallback: reject bind mounts as well as device crossings."""
    import ctypes
    import platform
    require(platform.machine() == 'x86_64', 'BROKER.PLATFORM')
    require(type(name) is str and '/' not in name and name not in ('', '.', '..'), 'BROKER.PATH')
    class OpenHow(ctypes.Structure):
        _fields_ = [('flags', ctypes.c_uint64), ('mode', ctypes.c_uint64), ('resolve', ctypes.c_uint64)]
    # Linux amd64 SYS_openat2=437; RESOLVE_NO_XDEV|NO_SYMLINKS|BENEATH.
    how = OpenHow(flags, 0, 0x01 | 0x04 | 0x08)
    libc = ctypes.CDLL(None, use_errno=True)
    libc.syscall.restype = ctypes.c_long
    result = libc.syscall(ctypes.c_long(437), ctypes.c_int(parent), ctypes.c_char_p(os.fsencode(name)), ctypes.byref(how), ctypes.c_size_t(ctypes.sizeof(how)))
    if result < 0:
        raise Refused('BROKER.PATH')
    return result


def open_beneath(parent, relative_path, owners=(0,)):
    fd = os.dup(parent)
    try:
        for part in relative(relative_path):
            child = open_relative(fd, part, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
            os.close(fd)
            fd = child
            info = os.fstat(fd)
            require(info.st_uid in owners and not info.st_mode & 0o022, 'BROKER.PATH')
        return fd
    except BaseException:
        os.close(fd)
        raise
