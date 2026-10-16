#define _GNU_SOURCE
#include <node_api.h>
#include <sys/socket.h>
#include <unistd.h>

/* Trusted Linux transport only. No path, execution or privilege-changing API. */
static napi_value credentials(napi_env env, napi_callback_info info) {
  napi_value arg, result, value;
  size_t argc = 1;
  int32_t fd = -1;
  struct ucred peer;
  socklen_t size = sizeof(peer);
  if (napi_get_cb_info(env, info, &argc, &arg, NULL, NULL) != napi_ok ||
      argc != 1 || napi_get_value_int32(env, arg, &fd) != napi_ok || fd < 0 ||
      getsockopt(fd, SOL_SOCKET, SO_PEERCRED, &peer, &size) ||
      size != sizeof(peer) || peer.pid <= 0) {
    napi_throw_error(env, "WORKER.PEER", "Unix peer identity unavailable");
    return NULL;
  }
  napi_create_object(env, &result);
  napi_create_int64(env, peer.pid, &value); napi_set_named_property(env, result, "pid", value);
  napi_create_int64(env, peer.uid, &value); napi_set_named_property(env, result, "uid", value);
  napi_create_int64(env, peer.gid, &value); napi_set_named_property(env, result, "gid", value);
  return result;
}
static napi_value init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "credentials", NAPI_AUTO_LENGTH, credentials, NULL, &fn);
  napi_set_named_property(env, exports, "credentials", fn);
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
