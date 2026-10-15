  // ==================== 签名验证（签名值 + 摘要 + 有效期） ====================
  // 已实现：① 签名值验证——GB/T 38540 SES 的 toSign 原始 DER，用签章人证书 SM2 公钥验签；
  //         ② 文件摘要比对（References[].CheckValue 与重算摘要逐字节比对）；
  //         ③ 印章有效期与证书有效期是否覆盖签名时间。
  // 未实现：证书链与信任根、吊销状态（CRL/OCSP）、时间戳验证、印章自身签名验证。
  // 注意：CheckValue 存放于 OFD 文件内部，改内容后可被同步重算，单靠「摘要一致」
  // 只说明文件自洽；签名值验证才是身份与完整性的依据。
  // 有效期校验：以签名时间（SignatureDateTime）为基准
  //   sealPeriod：印章属性 notBefore/notAfter 是否覆盖签名时间
  //   certPeriod：签名数据内所有证书的 Validity 是否都覆盖签名时间
  // 注意：这是「签名时刻」判定，不用当前时间——证书现在过期不代表签错。
  function checkPeriods(sig) {
    const out = { sealPeriod: "unknown", certPeriod: "unknown" };
    const t = asn1TimeToMs(sig.signTime);
    if (!isFinite(t)) return out;

    const a = sig.sealAttrs;
    if (a && (a.notBefore || a.notAfter)) {
      const nb = a.notBefore ? asn1TimeToMs(a.notBefore) : -Infinity;
      const na = a.notAfter ? asn1TimeToMs(a.notAfter) : Infinity;
      out.sealPeriod = t >= nb && t <= na ? "pass" : "fail";
    }

    const certs = sig.certValidity || [];
    if (certs.length) {
      const covered = certs.every((c) => {
        const nb = c.notBefore ? asn1TimeToMs(c.notBefore) : -Infinity;
        const na = c.notAfter ? asn1TimeToMs(c.notAfter) : Infinity;
        return t >= nb && t <= na;
      });
      out.certPeriod = covered ? "pass" : "fail";
    }
    return out;
  }

  // ② 签名值验证：用签章人证书公钥对 toSign 的原始 DER 做 SM2 验签（GB/T 38540）
  // 待签数据必须切原始字节，重新编码会导致摘要不同。
  async function verifySigValue(ofd, sig) {
    if (typeof SM_CRYPTO === "undefined" || !SM_CRYPTO || !SM_CRYPTO.sm2)
      return { state: "unknown", message: "未内置 SM2 库，签名值未验证" };
    if (!sig.signedValuePath)
      return { state: "unknown", message: "缺少签名值路径" };
    const raw = await readEntry(ofd.zip, sig.signedValuePath.replace(/^\//, ""));
    if (!raw) return { state: "unknown", message: "签名值文件缺失" };
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const blocks = parseSesSignBlocks(bytes);
    if (!blocks.length)
      return { state: "unknown", message: "未找到 SES 签名块（非 GB/T 38540 结构）" };

    let tried = 0;
    for (const b of blocks) {
      const algOid = oidDotStr(b.alg.content);
      if (algOid !== "1.2.156.10197.1.501")
        return { state: "unknown", message: "签名算法暂不支持：" + algOid };
      const pub = extractCertPublicKey(b.cert.content);
      if (!pub) continue;
      const sigBytes = b.sig.content.subarray(1); // 去掉 BIT STRING 的 unusedBits 字节
      let hex = "";
      for (let i = 0; i < sigBytes.length; i++)
        hex += ("0" + sigBytes[i].toString(16)).slice(-2);
      const tbs = bytes.subarray(b.tbs.off, b.tbs.off + b.tbs.derLen);
      tried++;
      try {
        if (
          SM_CRYPTO.sm2.doVerifySignature(tbs, hex, pub, {
            der: true,
            input: "array",
          })
        )
          return { state: "pass", message: "签名值验证通过" };
      } catch (e) {
        return { state: "unknown", message: "SM2 验签异常：" + e.message };
      }
    }
    if (!tried) return { state: "unknown", message: "签名数据中未取得可用公钥" };
    return { state: "fail", message: "签名值验证失败（签章数据可能被篡改）" };
  }

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

    const sv = await verifySigValue(ofd, sig);
    const periods = checkPeriods(sig);
    const checks = {
      digest: failed.length ? "fail" : checked.length ? "pass" : "unknown",
      sigValue: sv.state,
      sealPeriod: periods.sealPeriod,
      certPeriod: periods.certPeriod,
    };
    const rejected = [];
    if (sv.state === "fail") rejected.push(sv.message);
    if (periods.sealPeriod === "fail")
      rejected.push("印章有效期不覆盖签名时间");
    if (periods.certPeriod === "fail")
      rejected.push("证书有效期不覆盖签名时间");

    if (failed.length) {
      return {
        valid: false,
        status: "invalid",
        message: "验证失败：" + failed.join("；"),
        digestValid: false,
        checked: checked,
        failed: failed,
        checks: checks,
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
        checks: checks,
      };
    }
    if (rejected.length) {
      return {
        valid: false,
        status: "invalid",
        message:
          "摘要一致，但" +
          rejected.join("、") +
          "（" + checked.length + " 个文件摘要校验一致）",
        digestValid: true,
        checked: checked,
        failed: failed,
        checks: checks,
      };
    }
    const skipped = [];
    if (sv.state === "unknown") skipped.push(sv.message);
    if (periods.sealPeriod === "unknown") skipped.push("印章有效期");
    if (periods.certPeriod === "unknown") skipped.push("证书有效期");
    return {
      valid: true,
      status: "valid",
      message:
        "验证通过：" +
        checked.length +
        " 个文件摘要校验一致" +
        (skipped.length ? "；" + skipped.join("、") + "无数据，未校验" : ""),
      digestValid: true,
      checked: checked,
      failed: failed,
      checks: checks,
    };
  }

