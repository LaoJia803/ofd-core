  // ==================== 签名验证（仅文件摘要比对） ====================
  // 当前仅实现「文件摘要比对」：用签名中登记的 References[].CheckValue 与重新计算
  // 的摘要逐字节比对，用于检测文件内容是否被改动、受保护文件是否缺失。
  // 签名值验证、证书链验证、时间戳验证暂不实现（相关逻辑已移除，需要时再补）。
  // 注意：CheckValue 存放于 OFD 文件内部，改内容后可被同步重算，因此「摘要一致」
  // 只能说明文件自洽，不等同于签名真实有效。
  async function verifySignature(ofd, index) {
    const doc = ofd.document;
    const sig = doc.signatures && doc.signatures[index];
    if (!sig)
      return { valid: false, status: "unknown", message: "未找到该签名" };

    if (!sig.references || sig.references.length === 0) {
      return {
        valid: false,
        status: "unknown",
        message: "签名未包含摘要引用（References）数据，无法验证",
      };
    }

    const checked = [];
    const failed = [];
    for (const ref of sig.references) {
      if (!ref.fileRef || !ref.checkValue) continue;
      const data = await readEntry(ofd.zip, ref.fileRef.replace(/^\//, ""));
      if (!data) {
        failed.push(ref.fileRef + "（文件缺失）");
        continue;
      }
      let digest;
      try {
        digest = await hashBytes(data, sig.checkMethod);
      } catch (e) {
        return {
          valid: false,
          status: "unknown",
          message:
            "摘要算法暂不支持：" + (sig.checkMethod || "未知") + "，无法验证",
        };
      }
      const expected = base64ToBytes(ref.checkValue);
      if (digestMatches(digest, expected)) checked.push(ref.fileRef);
      else failed.push(ref.fileRef + "（摘要不一致）");
    }

    if (failed.length) {
      return {
        valid: false,
        status: "invalid",
        message: "验证失败：" + failed.join("；"),
        digestValid: false,
        checked: checked,
        failed: failed,
      };
    }
    if (!checked.length) {
      return {
        valid: false,
        status: "unknown",
        message: "没有可验证的摘要数据",
        digestValid: false,
        checked: checked,
        failed: failed,
      };
    }
    return {
      valid: true,
      status: "valid",
      message: "验证通过：" + checked.length + " 个文件摘要校验一致",
      digestValid: true,
      checked: checked,
      failed: failed,
    };
  }

