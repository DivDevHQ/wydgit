#!/usr/bin/python3
"""Nonroot launcher: authenticate the broker, then exec the fixed installed engine."""
import importlib.util
import os
import socket
import sys
sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('wydhosting_security', os.path.join(os.path.dirname(os.path.realpath(__file__)), 'security.py'))
s = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s)
RELEASE = '/opt/wydhosting/release'


def inherit_control(sock):
    os.dup2(sock.fileno(), 3, inheritable=True)
    # dup2(fd, fd) is a no-op on Linux, including the original CLOEXEC bit.
    os.set_inheritable(3, True)
    if sock.fileno() != 3:
        sock.close()


def main():
    s.require(os.getuid() >= 60000 and len(sys.argv) == 2, 'WORKER.IDENTITY')
    filename = sys.argv[1]
    import re
    s.require(re.fullmatch(r'/run/wydhosting/job-[a-f0-9]{32}\.json', filename))
    fd = s.open_directory('/run/wydhosting')
    try:
        job = s.decode(s.read_file(fd, filename.rsplit('/', 1)[-1]))
    finally:
        os.close(fd)
    s.closed(job, ('schema', 'socket', 'poolId', 'generation'))
    s.require(job['schema'] == 'wydhosting.worker-launch/1' and re.fullmatch(r'/run/wydhosting/worker-[a-f0-9]{32}\.sock', job['socket']))
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect(job['socket'])
    s.require(s.peercred(sock)[1] == 0, 'WORKER.PEER')
    s.write_frame(sock, {k: job[k] for k in ('schema', 'poolId', 'generation')})
    challenge = s.read_frame(sock)
    s.closed(challenge, ('challenge',))
    s.require(re.fullmatch('[a-f0-9]{64}', challenge['challenge']))
    s.write_frame(sock, {**challenge, 'poolId': job['poolId'], 'generation': job['generation']})
    sock.settimeout(None)
    inherit_control(sock)
    # All other descriptors are CLOEXEC. No source-controlled cwd/env/executable.
    os.execve(RELEASE + '/bin/node', [RELEASE + '/bin/node', RELEASE + '/node_modules/wydgine/bin/wydgine-worker.js', '--linux-service'],
              {'LANG': 'C.UTF-8', 'WYD_PEERCRED_HELPER': RELEASE + '/lib/peercred.node'})


if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.exit(70)
