// ==================== 通用数据结构 ====================
// LRU 缓存：SVG 页面缓存、ZIP 条目缓存、路径缩写缓存共用。
// class 不提升，故定义必须早于所有构造点。
export class LRUCache {
  constructor(max) {
    this._max = max;
    this._map = new Map();
  }
  get(key) {
    const v = this._map.get(key);
    if (v !== undefined) {
      this._map.delete(key);
      this._map.set(key, v);
    }
    return v;
  }
  set(key, val) {
    if (this._map.has(key)) this._map.delete(key);
    this._map.set(key, val);
    if (this._map.size > this._max) {
      const first = this._map.keys().next().value;
      this._map.delete(first);
    }
  }
  has(key) {
    return this._map.has(key);
  }
}

