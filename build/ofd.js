/*!
 * ofd.js v1.0.0 — OFD 纯前端解析与 SVG 渲染引擎
 * 零依赖，ZIP 解压使用浏览器原生 DecompressionStream
 */
(function (global) {
  "use strict";

/*! sm-crypto v0.5.7 | MIT License | https://github.com/JuneAndGreen/sm-crypto（esbuild 打包，含 jsbn v1.1.0） */
var SM_CRYPTO=(()=>{var _=(s,n)=>()=>{try{return n||s((n={exports:{}}).exports,n),n.exports}catch(o){throw n=0,o}};var at=_((bt,Wt)=>{(function(){var s,n=0xdeadbeefcafe,o=(n&16777215)==15715070;function r(t,e,i){t!=null&&(typeof t=="number"?this.fromNumber(t,e,i):e==null&&typeof t!="string"?this.fromString(t,256):this.fromString(t,e))}function h(){return new r(null)}function l(t,e,i,f,u,c){for(;--c>=0;){var a=e*this[t++]+i[f]+u;u=Math.floor(a/67108864),i[f++]=a&67108863}return u}function d(t,e,i,f,u,c){for(var a=e&32767,x=e>>15;--c>=0;){var E=this[t]&32767,I=this[t++]>>15,N=x*E+I*a;E=a*E+((N&32767)<<15)+i[f]+(u&1073741823),u=(E>>>30)+(N>>>15)+x*I+(u>>>30),i[f++]=E&1073741823}return u}function b(t,e,i,f,u,c){for(var a=e&16383,x=e>>14;--c>=0;){var E=this[t]&16383,I=this[t++]>>14,N=x*E+I*a;E=a*E+((N&16383)<<14)+i[f]+u,u=(E>>28)+(N>>14)+x*I,i[f++]=E&268435455}return u}var p=typeof navigator!="undefined";p&&o&&navigator.appName=="Microsoft Internet Explorer"?(r.prototype.am=d,s=30):p&&o&&navigator.appName!="Netscape"?(r.prototype.am=l,s=26):(r.prototype.am=b,s=28),r.prototype.DB=s,r.prototype.DM=(1<<s)-1,r.prototype.DV=1<<s;var F=52;r.prototype.FV=Math.pow(2,F),r.prototype.F1=F-s,r.prototype.F2=2*s-F;var g="0123456789abcdefghijklmnopqrstuvwxyz",m=new Array,y,w;for(y=48,w=0;w<=9;++w)m[y++]=w;for(y=97,w=10;w<36;++w)m[y++]=w;for(y=65,w=10;w<36;++w)m[y++]=w;function T(t){return g.charAt(t)}function S(t,e){var i=m[t.charCodeAt(e)];return i==null?-1:i}function q(t){for(var e=this.t-1;e>=0;--e)t[e]=this[e];t.t=this.t,t.s=this.s}function A(t){this.t=1,this.s=t<0?-1:0,t>0?this[0]=t:t<-1?this[0]=t+this.DV:this.t=0}function D(t){var e=h();return e.fromInt(t),e}function G(t,e){var i;if(e==16)i=4;else if(e==8)i=3;else if(e==256)i=8;else if(e==2)i=1;else if(e==32)i=5;else if(e==4)i=2;else{this.fromRadix(t,e);return}this.t=0,this.s=0;for(var f=t.length,u=!1,c=0;--f>=0;){var a=i==8?t[f]&255:S(t,f);if(a<0){t.charAt(f)=="-"&&(u=!0);continue}u=!1,c==0?this[this.t++]=a:c+i>this.DB?(this[this.t-1]|=(a&(1<<this.DB-c)-1)<<c,this[this.t++]=a>>this.DB-c):this[this.t-1]|=a<<c,c+=i,c>=this.DB&&(c-=this.DB)}i==8&&(t[0]&128)!=0&&(this.s=-1,c>0&&(this[this.t-1]|=(1<<this.DB-c)-1<<c)),this.clamp(),u&&r.ZERO.subTo(this,this)}function K(){for(var t=this.s&this.DM;this.t>0&&this[this.t-1]==t;)--this.t}function J(t){if(this.s<0)return"-"+this.negate().toString(t);var e;if(t==16)e=4;else if(t==8)e=3;else if(t==2)e=1;else if(t==32)e=5;else if(t==4)e=2;else return this.toRadix(t);var i=(1<<e)-1,f,u=!1,c="",a=this.t,x=this.DB-a*this.DB%e;if(a-- >0)for(x<this.DB&&(f=this[a]>>x)>0&&(u=!0,c=T(f));a>=0;)x<e?(f=(this[a]&(1<<x)-1)<<e-x,f|=this[--a]>>(x+=this.DB-e)):(f=this[a]>>(x-=e)&i,x<=0&&(x+=this.DB,--a)),f>0&&(u=!0),u&&(c+=T(f));return u?c:"0"}function $(){var t=h();return r.ZERO.subTo(this,t),t}function dt(){return this.s<0?this.negate():this}function gt(t){var e=this.s-t.s;if(e!=0)return e;var i=this.t;if(e=i-t.t,e!=0)return this.s<0?-e:e;for(;--i>=0;)if((e=this[i]-t[i])!=0)return e;return 0}function tt(t){var e=1,i;return(i=t>>>16)!=0&&(t=i,e+=16),(i=t>>8)!=0&&(t=i,e+=8),(i=t>>4)!=0&&(t=i,e+=4),(i=t>>2)!=0&&(t=i,e+=2),(i=t>>1)!=0&&(t=i,e+=1),e}function mt(){return this.t<=0?0:this.DB*(this.t-1)+tt(this[this.t-1]^this.s&this.DM)}function B(t,e){var i;for(i=this.t-1;i>=0;--i)e[i+t]=this[i];for(i=t-1;i>=0;--i)e[i]=0;e.t=this.t+t,e.s=this.s}function Pe(t,e){for(var i=t;i<this.t;++i)e[i-t]=this[i];e.t=Math.max(this.t-t,0),e.s=this.s}function Ae(t,e){var i=t%this.DB,f=this.DB-i,u=(1<<f)-1,c=Math.floor(t/this.DB),a=this.s<<i&this.DM,x;for(x=this.t-1;x>=0;--x)e[x+c+1]=this[x]>>f|a,a=(this[x]&u)<<i;for(x=c-1;x>=0;--x)e[x]=0;e[c]=a,e.t=this.t+c+1,e.s=this.s,e.clamp()}function Ce(t,e){e.s=this.s;var i=Math.floor(t/this.DB);if(i>=this.t){e.t=0;return}var f=t%this.DB,u=this.DB-f,c=(1<<f)-1;e[0]=this[i]>>f;for(var a=i+1;a<this.t;++a)e[a-i-1]|=(this[a]&c)<<u,e[a-i]=this[a]>>f;f>0&&(e[this.t-i-1]|=(this.s&c)<<u),e.t=this.t-i,e.clamp()}function Me(t,e){for(var i=0,f=0,u=Math.min(t.t,this.t);i<u;)f+=this[i]-t[i],e[i++]=f&this.DM,f>>=this.DB;if(t.t<this.t){for(f-=t.s;i<this.t;)f+=this[i],e[i++]=f&this.DM,f>>=this.DB;f+=this.s}else{for(f+=this.s;i<t.t;)f-=t[i],e[i++]=f&this.DM,f>>=this.DB;f-=t.s}e.s=f<0?-1:0,f<-1?e[i++]=this.DV+f:f>0&&(e[i++]=f),e.t=i,e.clamp()}function Oe(t,e){var i=this.abs(),f=t.abs(),u=i.t;for(e.t=u+f.t;--u>=0;)e[u]=0;for(u=0;u<f.t;++u)e[u+i.t]=i.am(0,f[u],e,u,0,i.t);e.s=0,e.clamp(),this.s!=t.s&&r.ZERO.subTo(e,e)}function He(t){for(var e=this.abs(),i=t.t=2*e.t;--i>=0;)t[i]=0;for(i=0;i<e.t-1;++i){var f=e.am(i,e[i],t,2*i,0,1);(t[i+e.t]+=e.am(i+1,2*e[i],t,2*i+1,f,e.t-i-1))>=e.DV&&(t[i+e.t]-=e.DV,t[i+e.t+1]=1)}t.t>0&&(t[t.t-1]+=e.am(i,e[i],t,2*i,0,1)),t.s=0,t.clamp()}function Le(t,e,i){var f=t.abs();if(!(f.t<=0)){var u=this.abs();if(u.t<f.t){e!=null&&e.fromInt(0),i!=null&&this.copyTo(i);return}i==null&&(i=h());var c=h(),a=this.s,x=t.s,E=this.DB-tt(f[f.t-1]);E>0?(f.lShiftTo(E,c),u.lShiftTo(E,i)):(f.copyTo(c),u.copyTo(i));var I=c.t,N=c[I-1];if(N!=0){var L=N*(1<<this.F1)+(I>1?c[I-2]>>this.F2:0),X=this.FV/L,vt=(1<<this.F1)/L,j=1<<this.F2,U=i.t,wt=U-I,Q=e==null?h():e;for(c.dlShiftTo(wt,Q),i.compareTo(Q)>=0&&(i[i.t++]=1,i.subTo(Q,i)),r.ONE.dlShiftTo(I,Q),Q.subTo(c,c);c.t<I;)c[c.t++]=0;for(;--wt>=0;){var Ot=i[--U]==N?this.DM:Math.floor(i[U]*X+(i[U-1]+j)*vt);if((i[U]+=c.am(0,Ot,i,wt,0,I))<Ot)for(c.dlShiftTo(wt,Q),i.subTo(Q,i);i[U]<--Ot;)i.subTo(Q,i)}e!=null&&(i.drShiftTo(I,e),a!=x&&r.ZERO.subTo(e,e)),i.t=I,i.clamp(),E>0&&i.rShiftTo(E,i),a<0&&r.ZERO.subTo(i,i)}}}function Ne(t){var e=h();return this.abs().divRemTo(t,null,e),this.s<0&&e.compareTo(r.ZERO)>0&&t.subTo(e,e),e}function et(t){this.m=t}function Ve(t){return t.s<0||t.compareTo(this.m)>=0?t.mod(this.m):t}function ze(t){return t}function je(t){t.divRemTo(this.m,null,t)}function Ue(t,e,i){t.multiplyTo(e,i),this.reduce(i)}function ke(t,e){t.squareTo(e),this.reduce(e)}et.prototype.convert=Ve,et.prototype.revert=ze,et.prototype.reduce=je,et.prototype.mulTo=Ue,et.prototype.sqrTo=ke;function Ze(){if(this.t<1)return 0;var t=this[0];if((t&1)==0)return 0;var e=t&3;return e=e*(2-(t&15)*e)&15,e=e*(2-(t&255)*e)&255,e=e*(2-((t&65535)*e&65535))&65535,e=e*(2-t*e%this.DV)%this.DV,e>0?this.DV-e:-e}function it(t){this.m=t,this.mp=t.invDigit(),this.mpl=this.mp&32767,this.mph=this.mp>>15,this.um=(1<<t.DB-15)-1,this.mt2=2*t.t}function Ye(t){var e=h();return t.abs().dlShiftTo(this.m.t,e),e.divRemTo(this.m,null,e),t.s<0&&e.compareTo(r.ZERO)>0&&this.m.subTo(e,e),e}function Ge(t){var e=h();return t.copyTo(e),this.reduce(e),e}function _e(t){for(;t.t<=this.mt2;)t[t.t++]=0;for(var e=0;e<this.m.t;++e){var i=t[e]&32767,f=i*this.mpl+((i*this.mph+(t[e]>>15)*this.mpl&this.um)<<15)&t.DM;for(i=e+this.m.t,t[i]+=this.m.am(0,f,t,e,0,this.m.t);t[i]>=t.DV;)t[i]-=t.DV,t[++i]++}t.clamp(),t.drShiftTo(this.m.t,t),t.compareTo(this.m)>=0&&t.subTo(this.m,t)}function Ke(t,e){t.squareTo(e),this.reduce(e)}function Xe(t,e,i){t.multiplyTo(e,i),this.reduce(i)}it.prototype.convert=Ye,it.prototype.revert=Ge,it.prototype.reduce=_e,it.prototype.mulTo=Xe,it.prototype.sqrTo=Ke;function Qe(){return(this.t>0?this[0]&1:this.s)==0}function We(t,e){if(t>4294967295||t<1)return r.ONE;var i=h(),f=h(),u=e.convert(this),c=tt(t)-1;for(u.copyTo(i);--c>=0;)if(e.sqrTo(i,f),(t&1<<c)>0)e.mulTo(f,u,i);else{var a=i;i=f,f=a}return e.revert(i)}function Je(t,e){var i;return t<256||e.isEven()?i=new et(e):i=new it(e),this.exp(t,i)}r.prototype.copyTo=q,r.prototype.fromInt=A,r.prototype.fromString=G,r.prototype.clamp=K,r.prototype.dlShiftTo=B,r.prototype.drShiftTo=Pe,r.prototype.lShiftTo=Ae,r.prototype.rShiftTo=Ce,r.prototype.subTo=Me,r.prototype.multiplyTo=Oe,r.prototype.squareTo=He,r.prototype.divRemTo=Le,r.prototype.invDigit=Ze,r.prototype.isEven=Qe,r.prototype.exp=We,r.prototype.toString=J,r.prototype.negate=$,r.prototype.abs=dt,r.prototype.compareTo=gt,r.prototype.bitLength=mt,r.prototype.mod=Ne,r.prototype.modPowInt=Je,r.ZERO=D(0),r.ONE=D(1);function $e(){var t=h();return this.copyTo(t),t}function ti(){if(this.s<0){if(this.t==1)return this[0]-this.DV;if(this.t==0)return-1}else{if(this.t==1)return this[0];if(this.t==0)return 0}return(this[1]&(1<<32-this.DB)-1)<<this.DB|this[0]}function ei(){return this.t==0?this.s:this[0]<<24>>24}function ii(){return this.t==0?this.s:this[0]<<16>>16}function ni(t){return Math.floor(Math.LN2*this.DB/Math.log(t))}function ri(){return this.s<0?-1:this.t<=0||this.t==1&&this[0]<=0?0:1}function si(t){if(t==null&&(t=10),this.signum()==0||t<2||t>36)return"0";var e=this.chunkSize(t),i=Math.pow(t,e),f=D(i),u=h(),c=h(),a="";for(this.divRemTo(f,u,c);u.signum()>0;)a=(i+c.intValue()).toString(t).substr(1)+a,u.divRemTo(f,u,c);return c.intValue().toString(t)+a}function oi(t,e){this.fromInt(0),e==null&&(e=10);for(var i=this.chunkSize(e),f=Math.pow(e,i),u=!1,c=0,a=0,x=0;x<t.length;++x){var E=S(t,x);if(E<0){t.charAt(x)=="-"&&this.signum()==0&&(u=!0);continue}a=e*a+E,++c>=i&&(this.dMultiply(f),this.dAddOffset(a,0),c=0,a=0)}c>0&&(this.dMultiply(Math.pow(e,c)),this.dAddOffset(a,0)),u&&r.ZERO.subTo(this,this)}function fi(t,e,i){if(typeof e=="number")if(t<2)this.fromInt(1);else for(this.fromNumber(t,i),this.testBit(t-1)||this.bitwiseTo(r.ONE.shiftLeft(t-1),Pt,this),this.isEven()&&this.dAddOffset(1,0);!this.isProbablePrime(e);)this.dAddOffset(2,0),this.bitLength()>t&&this.subTo(r.ONE.shiftLeft(t-1),this);else{var f=new Array,u=t&7;f.length=(t>>3)+1,e.nextBytes(f),u>0?f[0]&=(1<<u)-1:f[0]=0,this.fromString(f,256)}}function hi(){var t=this.t,e=new Array;e[0]=this.s;var i=this.DB-t*this.DB%8,f,u=0;if(t-- >0)for(i<this.DB&&(f=this[t]>>i)!=(this.s&this.DM)>>i&&(e[u++]=f|this.s<<this.DB-i);t>=0;)i<8?(f=(this[t]&(1<<i)-1)<<8-i,f|=this[--t]>>(i+=this.DB-8)):(f=this[t]>>(i-=8)&255,i<=0&&(i+=this.DB,--t)),(f&128)!=0&&(f|=-256),u==0&&(this.s&128)!=(f&128)&&++u,(u>0||f!=this.s)&&(e[u++]=f);return e}function ui(t){return this.compareTo(t)==0}function li(t){return this.compareTo(t)<0?this:t}function ci(t){return this.compareTo(t)>0?this:t}function ai(t,e,i){var f,u,c=Math.min(t.t,this.t);for(f=0;f<c;++f)i[f]=e(this[f],t[f]);if(t.t<this.t){for(u=t.s&this.DM,f=c;f<this.t;++f)i[f]=e(this[f],u);i.t=this.t}else{for(u=this.s&this.DM,f=c;f<t.t;++f)i[f]=e(u,t[f]);i.t=t.t}i.s=e(this.s,t.s),i.clamp()}function xi(t,e){return t&e}function pi(t){var e=h();return this.bitwiseTo(t,xi,e),e}function Pt(t,e){return t|e}function di(t){var e=h();return this.bitwiseTo(t,Pt,e),e}function Yt(t,e){return t^e}function gi(t){var e=h();return this.bitwiseTo(t,Yt,e),e}function Gt(t,e){return t&~e}function mi(t){var e=h();return this.bitwiseTo(t,Gt,e),e}function yi(){for(var t=h(),e=0;e<this.t;++e)t[e]=this.DM&~this[e];return t.t=this.t,t.s=~this.s,t}function vi(t){var e=h();return t<0?this.rShiftTo(-t,e):this.lShiftTo(t,e),e}function wi(t){var e=h();return t<0?this.lShiftTo(-t,e):this.rShiftTo(t,e),e}function bi(t){if(t==0)return-1;var e=0;return(t&65535)==0&&(t>>=16,e+=16),(t&255)==0&&(t>>=8,e+=8),(t&15)==0&&(t>>=4,e+=4),(t&3)==0&&(t>>=2,e+=2),(t&1)==0&&++e,e}function Ti(){for(var t=0;t<this.t;++t)if(this[t]!=0)return t*this.DB+bi(this[t]);return this.s<0?this.t*this.DB:-1}function Fi(t){for(var e=0;t!=0;)t&=t-1,++e;return e}function Bi(){for(var t=0,e=this.s&this.DM,i=0;i<this.t;++i)t+=Fi(this[i]^e);return t}function Ei(t){var e=Math.floor(t/this.DB);return e>=this.t?this.s!=0:(this[e]&1<<t%this.DB)!=0}function Si(t,e){var i=r.ONE.shiftLeft(t);return this.bitwiseTo(i,e,i),i}function Di(t){return this.changeBit(t,Pt)}function Ri(t){return this.changeBit(t,Gt)}function Ii(t){return this.changeBit(t,Yt)}function qi(t,e){for(var i=0,f=0,u=Math.min(t.t,this.t);i<u;)f+=this[i]+t[i],e[i++]=f&this.DM,f>>=this.DB;if(t.t<this.t){for(f+=t.s;i<this.t;)f+=this[i],e[i++]=f&this.DM,f>>=this.DB;f+=this.s}else{for(f+=this.s;i<t.t;)f+=t[i],e[i++]=f&this.DM,f>>=this.DB;f+=t.s}e.s=f<0?-1:0,f>0?e[i++]=f:f<-1&&(e[i++]=this.DV+f),e.t=i,e.clamp()}function Pi(t){var e=h();return this.addTo(t,e),e}function Ai(t){var e=h();return this.subTo(t,e),e}function Ci(t){var e=h();return this.multiplyTo(t,e),e}function Mi(){var t=h();return this.squareTo(t),t}function Oi(t){var e=h();return this.divRemTo(t,e,null),e}function Hi(t){var e=h();return this.divRemTo(t,null,e),e}function Li(t){var e=h(),i=h();return this.divRemTo(t,e,i),new Array(e,i)}function Ni(t){this[this.t]=this.am(0,t-1,this,0,0,this.t),++this.t,this.clamp()}function Vi(t,e){if(t!=0){for(;this.t<=e;)this[this.t++]=0;for(this[e]+=t;this[e]>=this.DV;)this[e]-=this.DV,++e>=this.t&&(this[this.t++]=0),++this[e]}}function ct(){}function _t(t){return t}function zi(t,e,i){t.multiplyTo(e,i)}function ji(t,e){t.squareTo(e)}ct.prototype.convert=_t,ct.prototype.revert=_t,ct.prototype.mulTo=zi,ct.prototype.sqrTo=ji;function Ui(t){return this.exp(t,new ct)}function ki(t,e,i){var f=Math.min(this.t+t.t,e);for(i.s=0,i.t=f;f>0;)i[--f]=0;var u;for(u=i.t-this.t;f<u;++f)i[f+this.t]=this.am(0,t[f],i,f,0,this.t);for(u=Math.min(t.t,e);f<u;++f)this.am(0,t[f],i,f,0,e-f);i.clamp()}function Zi(t,e,i){--e;var f=i.t=this.t+t.t-e;for(i.s=0;--f>=0;)i[f]=0;for(f=Math.max(e-this.t,0);f<t.t;++f)i[this.t+f-e]=this.am(e-f,t[f],i,0,0,this.t+f-e);i.clamp(),i.drShiftTo(1,i)}function nt(t){this.r2=h(),this.q3=h(),r.ONE.dlShiftTo(2*t.t,this.r2),this.mu=this.r2.divide(t),this.m=t}function Yi(t){if(t.s<0||t.t>2*this.m.t)return t.mod(this.m);if(t.compareTo(this.m)<0)return t;var e=h();return t.copyTo(e),this.reduce(e),e}function Gi(t){return t}function _i(t){for(t.drShiftTo(this.m.t-1,this.r2),t.t>this.m.t+1&&(t.t=this.m.t+1,t.clamp()),this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3),this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);t.compareTo(this.r2)<0;)t.dAddOffset(1,this.m.t+1);for(t.subTo(this.r2,t);t.compareTo(this.m)>=0;)t.subTo(this.m,t)}function Ki(t,e){t.squareTo(e),this.reduce(e)}function Xi(t,e,i){t.multiplyTo(e,i),this.reduce(i)}nt.prototype.convert=Yi,nt.prototype.revert=Gi,nt.prototype.reduce=_i,nt.prototype.mulTo=Xi,nt.prototype.sqrTo=Ki;function Qi(t,e){var i=t.bitLength(),f,u=D(1),c;if(i<=0)return u;i<18?f=1:i<48?f=3:i<144?f=4:i<768?f=5:f=6,i<8?c=new et(e):e.isEven()?c=new nt(e):c=new it(e);var a=new Array,x=3,E=f-1,I=(1<<f)-1;if(a[1]=c.convert(this),f>1){var N=h();for(c.sqrTo(a[1],N);x<=I;)a[x]=h(),c.mulTo(N,a[x-2],a[x]),x+=2}var L=t.t-1,X,vt=!0,j=h(),U;for(i=tt(t[L])-1;L>=0;){for(i>=E?X=t[L]>>i-E&I:(X=(t[L]&(1<<i+1)-1)<<E-i,L>0&&(X|=t[L-1]>>this.DB+i-E)),x=f;(X&1)==0;)X>>=1,--x;if((i-=x)<0&&(i+=this.DB,--L),vt)a[X].copyTo(u),vt=!1;else{for(;x>1;)c.sqrTo(u,j),c.sqrTo(j,u),x-=2;x>0?c.sqrTo(u,j):(U=u,u=j,j=U),c.mulTo(j,a[X],u)}for(;L>=0&&(t[L]&1<<i)==0;)c.sqrTo(u,j),U=u,u=j,j=U,--i<0&&(i=this.DB-1,--L)}return c.revert(u)}function Wi(t){var e=this.s<0?this.negate():this.clone(),i=t.s<0?t.negate():t.clone();if(e.compareTo(i)<0){var f=e;e=i,i=f}var u=e.getLowestSetBit(),c=i.getLowestSetBit();if(c<0)return e;for(u<c&&(c=u),c>0&&(e.rShiftTo(c,e),i.rShiftTo(c,i));e.signum()>0;)(u=e.getLowestSetBit())>0&&e.rShiftTo(u,e),(u=i.getLowestSetBit())>0&&i.rShiftTo(u,i),e.compareTo(i)>=0?(e.subTo(i,e),e.rShiftTo(1,e)):(i.subTo(e,i),i.rShiftTo(1,i));return c>0&&i.lShiftTo(c,i),i}function Ji(t){if(t<=0)return 0;var e=this.DV%t,i=this.s<0?t-1:0;if(this.t>0)if(e==0)i=this[0]%t;else for(var f=this.t-1;f>=0;--f)i=(e*i+this[f])%t;return i}function $i(t){var e=t.isEven();if(this.isEven()&&e||t.signum()==0)return r.ZERO;for(var i=t.clone(),f=this.clone(),u=D(1),c=D(0),a=D(0),x=D(1);i.signum()!=0;){for(;i.isEven();)i.rShiftTo(1,i),e?((!u.isEven()||!c.isEven())&&(u.addTo(this,u),c.subTo(t,c)),u.rShiftTo(1,u)):c.isEven()||c.subTo(t,c),c.rShiftTo(1,c);for(;f.isEven();)f.rShiftTo(1,f),e?((!a.isEven()||!x.isEven())&&(a.addTo(this,a),x.subTo(t,x)),a.rShiftTo(1,a)):x.isEven()||x.subTo(t,x),x.rShiftTo(1,x);i.compareTo(f)>=0?(i.subTo(f,i),e&&u.subTo(a,u),c.subTo(x,c)):(f.subTo(i,f),e&&a.subTo(u,a),x.subTo(c,x))}if(f.compareTo(r.ONE)!=0)return r.ZERO;if(x.compareTo(t)>=0)return x.subtract(t);if(x.signum()<0)x.addTo(t,x);else return x;return x.signum()<0?x.add(t):x}var C=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997],tn=(1<<26)/C[C.length-1];function en(t){var e,i=this.abs();if(i.t==1&&i[0]<=C[C.length-1]){for(e=0;e<C.length;++e)if(i[0]==C[e])return!0;return!1}if(i.isEven())return!1;for(e=1;e<C.length;){for(var f=C[e],u=e+1;u<C.length&&f<tn;)f*=C[u++];for(f=i.modInt(f);e<u;)if(f%C[e++]==0)return!1}return i.millerRabin(t)}function nn(t){var e=this.subtract(r.ONE),i=e.getLowestSetBit();if(i<=0)return!1;var f=e.shiftRight(i);t=t+1>>1,t>C.length&&(t=C.length);for(var u=h(),c=0;c<t;++c){u.fromInt(C[Math.floor(Math.random()*C.length)]);var a=u.modPow(f,this);if(a.compareTo(r.ONE)!=0&&a.compareTo(e)!=0){for(var x=1;x++<i&&a.compareTo(e)!=0;)if(a=a.modPowInt(2,this),a.compareTo(r.ONE)==0)return!1;if(a.compareTo(e)!=0)return!1}}return!0}r.prototype.chunkSize=ni,r.prototype.toRadix=si,r.prototype.fromRadix=oi,r.prototype.fromNumber=fi,r.prototype.bitwiseTo=ai,r.prototype.changeBit=Si,r.prototype.addTo=qi,r.prototype.dMultiply=Ni,r.prototype.dAddOffset=Vi,r.prototype.multiplyLowerTo=ki,r.prototype.multiplyUpperTo=Zi,r.prototype.modInt=Ji,r.prototype.millerRabin=nn,r.prototype.clone=$e,r.prototype.intValue=ti,r.prototype.byteValue=ei,r.prototype.shortValue=ii,r.prototype.signum=ri,r.prototype.toByteArray=hi,r.prototype.equals=ui,r.prototype.min=li,r.prototype.max=ci,r.prototype.and=pi,r.prototype.or=di,r.prototype.xor=gi,r.prototype.andNot=mi,r.prototype.not=yi,r.prototype.shiftLeft=vi,r.prototype.shiftRight=wi,r.prototype.getLowestSetBit=Ti,r.prototype.bitCount=Bi,r.prototype.testBit=Ei,r.prototype.setBit=Di,r.prototype.clearBit=Ri,r.prototype.flipBit=Ii,r.prototype.add=Pi,r.prototype.subtract=Ai,r.prototype.multiply=Ci,r.prototype.divide=Oi,r.prototype.remainder=Hi,r.prototype.divideAndRemainder=Li,r.prototype.modPow=Qi,r.prototype.modInverse=$i,r.prototype.pow=Ui,r.prototype.gcd=Wi,r.prototype.isProbablePrime=en,r.prototype.square=Mi,r.prototype.Barrett=nt;var yt,H,R;function rn(t){H[R++]^=t&255,H[R++]^=t>>8&255,H[R++]^=t>>16&255,H[R++]^=t>>24&255,R>=Mt&&(R-=Mt)}function Kt(){rn(new Date().getTime())}if(H==null){H=new Array,R=0;var z;if(typeof window!="undefined"&&window.crypto){if(window.crypto.getRandomValues){var Xt=new Uint8Array(32);for(window.crypto.getRandomValues(Xt),z=0;z<32;++z)H[R++]=Xt[z]}else if(navigator.appName=="Netscape"&&navigator.appVersion<"5"){var Qt=window.crypto.random(32);for(z=0;z<Qt.length;++z)H[R++]=Qt.charCodeAt(z)&255}}for(;R<Mt;)z=Math.floor(65536*Math.random()),H[R++]=z>>>8,H[R++]=z&255;R=0,Kt()}function sn(){if(yt==null){for(Kt(),yt=un(),yt.init(H),R=0;R<H.length;++R)H[R]=0;R=0}return yt.next()}function on(t){var e;for(e=0;e<t.length;++e)t[e]=sn()}function At(){}At.prototype.nextBytes=on;function Ct(){this.i=0,this.j=0,this.S=new Array}function fn(t){var e,i,f;for(e=0;e<256;++e)this.S[e]=e;for(i=0,e=0;e<256;++e)i=i+this.S[e]+t[e%t.length]&255,f=this.S[e],this.S[e]=this.S[i],this.S[i]=f;this.i=0,this.j=0}function hn(){var t;return this.i=this.i+1&255,this.j=this.j+this.S[this.i]&255,t=this.S[this.i],this.S[this.i]=this.S[this.j],this.S[this.j]=t,this.S[t+this.S[this.i]&255]}Ct.prototype.init=fn,Ct.prototype.next=hn;function un(){return new Ct}var Mt=256;typeof bt!="undefined"?bt=Wt.exports={default:r,BigInteger:r,SecureRandom:At}:this.jsbn={BigInteger:r,SecureRandom:At}}).call(bt)});var ie=_((Gn,ee)=>{var{BigInteger:Tt}=at();function ln(s){let n=s.toString(16);if(n[0]!=="-")n.length%2===1?n="0"+n:n.match(/^[0-7]/)||(n="00"+n);else{n=n.substr(1);let o=n.length;o%2===1?o+=1:n.match(/^[0-7]/)||(o+=2);let r="";for(let h=0;h<o;h++)r+="f";r=new Tt(r,16),n=r.xor(s).add(Tt.ONE),n=n.toString(16).replace(/^-/,"")}return n}var Ft=class{constructor(){this.tlv=null,this.t="00",this.l="00",this.v=""}getEncodedHex(){return this.tlv||(this.v=this.getValue(),this.l=this.getLength(),this.tlv=this.t+this.l+this.v),this.tlv}getLength(){let n=this.v.length/2,o=n.toString(16);return o.length%2===1&&(o="0"+o),n<128?o:(128+o.length/2).toString(16)+o}getValue(){return""}},Bt=class extends Ft{constructor(n){super(),this.t="02",n&&(this.v=ln(n))}getValue(){return this.v}},Ht=class extends Ft{constructor(n){super(),this.t="30",this.asn1Array=n}getValue(){return this.v=this.asn1Array.map(n=>n.getEncodedHex()).join(""),this.v}};function te(s,n){if(n+2>s.length)throw new Error("invalid DER: length field truncated");let o=parseInt(s.substring(n,n+2),16);if(o<128)return{len:o,lenOfL:1};let r=o&127;if(r===0)throw new Error("invalid DER: indefinite length not allowed");if(r>4)throw new Error("invalid DER: length too large");if(n+2+r*2>s.length)throw new Error("invalid DER: length field truncated");let h=s.substring(n+2,n+2+r*2),l=parseInt(h,16);if(l<128)throw new Error("invalid DER: length not minimally encoded (should use short form)");if(h.substring(0,2)==="00")throw new Error("invalid DER: length has leading zero byte");return{len:l,lenOfL:1+r}}function Jt(s,n){if(n+2>s.length)throw new Error("invalid DER: tag field truncated");let o=s.substring(n,n+2),{len:r,lenOfL:h}=te(s,n+2),l=n+2+h*2,d=l+r*2;if(d>s.length)throw new Error("invalid DER: value truncated");return{tag:o,valueHex:s.substring(l,d),nextStart:d}}function $t(s){if(s.length===0)throw new Error("invalid DER: INTEGER is empty");let n=parseInt(s.substring(0,2),16);if(n&128)throw new Error("invalid DER: INTEGER is negative");if(n===0){if(s.length===2)return;if(!(parseInt(s.substring(2,4),16)&128))throw new Error("invalid DER: INTEGER has non-minimal leading zero")}}ee.exports={encodeDer(s,n){let o=new Bt(s),r=new Bt(n);return new Ht([o,r]).getEncodedHex()},decodeDer(s){if(typeof s!="string"||s.length%2!==0)throw new Error("invalid DER: input must be a hex string of even length");if(s.substring(0,2)!=="30")throw new Error("invalid DER: expected SEQUENCE (0x30)");let n=te(s,2),o=2+n.lenOfL*2;if(o+n.len*2!==s.length)throw new Error("invalid DER: SEQUENCE length does not match input length");let r=Jt(s,o);if(r.tag!=="02")throw new Error("invalid DER: expected INTEGER (0x02) for R");$t(r.valueHex);let h=Jt(s,r.nextStart);if(h.tag!=="02")throw new Error("invalid DER: expected INTEGER (0x02) for S");if($t(h.valueHex),h.nextStart!==s.length)throw new Error("invalid DER: trailing bytes inside SEQUENCE");let l=new Tt(r.valueHex,16),d=new Tt(h.valueHex,16);return{r:l,s:d}}}});var oe=_((_n,se)=>{var{BigInteger:M}=at(),ne=new M("2"),re=new M("3"),Lt=class s{constructor(n,o){this.x=o,this.q=n}equals(n){return n===this?!0:this.q.equals(n.q)&&this.x.equals(n.x)}toBigInteger(){return this.x}negate(){return new s(this.q,this.x.negate().mod(this.q))}add(n){return new s(this.q,this.x.add(n.toBigInteger()).mod(this.q))}subtract(n){return new s(this.q,this.x.subtract(n.toBigInteger()).mod(this.q))}multiply(n){return new s(this.q,this.x.multiply(n.toBigInteger()).mod(this.q))}divide(n){return new s(this.q,this.x.multiply(n.toBigInteger().modInverse(this.q)).mod(this.q))}square(){return new s(this.q,this.x.square().mod(this.q))}},ot=class s{constructor(n,o,r,h){this.curve=n,this.x=o,this.y=r,this.z=h==null?M.ONE:h,this.zinv=null}getX(){return this.zinv===null&&(this.zinv=this.z.modInverse(this.curve.q)),this.curve.fromBigInteger(this.x.toBigInteger().multiply(this.zinv).mod(this.curve.q))}getY(){return this.zinv===null&&(this.zinv=this.z.modInverse(this.curve.q)),this.curve.fromBigInteger(this.y.toBigInteger().multiply(this.zinv).mod(this.curve.q))}equals(n){return n===this?!0:this.isInfinity()?n.isInfinity():n.isInfinity()?this.isInfinity():n.y.toBigInteger().multiply(this.z).subtract(this.y.toBigInteger().multiply(n.z)).mod(this.curve.q).equals(M.ZERO)?n.x.toBigInteger().multiply(this.z).subtract(this.x.toBigInteger().multiply(n.z)).mod(this.curve.q).equals(M.ZERO):!1}isInfinity(){return this.x===null&&this.y===null?!0:this.z.equals(M.ZERO)&&!this.y.toBigInteger().equals(M.ZERO)}negate(){return new s(this.curve,this.x,this.y.negate(),this.z)}add(n){if(this.isInfinity())return n;if(n.isInfinity())return this;let o=this.x.toBigInteger(),r=this.y.toBigInteger(),h=this.z,l=n.x.toBigInteger(),d=n.y.toBigInteger(),b=n.z,p=this.curve.q,F=o.multiply(b).mod(p),g=l.multiply(h).mod(p),m=F.subtract(g),y=r.multiply(b).mod(p),w=d.multiply(h).mod(p),T=y.subtract(w);if(M.ZERO.equals(m))return M.ZERO.equals(T)?this.twice():this.curve.infinity;let S=F.add(g),q=h.multiply(b).mod(p),A=m.square().mod(p),D=m.multiply(A).mod(p),G=q.multiply(T.square()).subtract(S.multiply(A)).mod(p),K=m.multiply(G).mod(p),J=T.multiply(A.multiply(F).subtract(G)).subtract(y.multiply(D)).mod(p),$=D.multiply(q).mod(p);return new s(this.curve,this.curve.fromBigInteger(K),this.curve.fromBigInteger(J),$)}twice(){if(this.isInfinity())return this;if(!this.y.toBigInteger().signum())return this.curve.infinity;let n=this.x.toBigInteger(),o=this.y.toBigInteger(),r=this.z,h=this.curve.q,l=this.curve.a.toBigInteger(),d=n.square().multiply(re).add(l.multiply(r.square())).mod(h),b=o.shiftLeft(1).multiply(r).mod(h),p=o.square().mod(h),F=p.multiply(n).multiply(r).mod(h),g=b.square().mod(h),m=d.square().subtract(F.shiftLeft(3)).mod(h),y=b.multiply(m).mod(h),w=d.multiply(F.shiftLeft(2).subtract(m)).subtract(g.shiftLeft(1).multiply(p)).mod(h),T=b.multiply(g).mod(h);return new s(this.curve,this.curve.fromBigInteger(y),this.curve.fromBigInteger(w),T)}multiply(n){if(this.isInfinity())return this;if(!n.signum())return this.curve.infinity;let o=n.multiply(re),r=this.negate(),h=this;for(let l=o.bitLength()-2;l>0;l--){h=h.twice();let d=o.testBit(l),b=n.testBit(l);d!==b&&(h=h.add(d?this:r))}return h}},Nt=class{constructor(n,o,r){this.q=n,this.a=this.fromBigInteger(o),this.b=this.fromBigInteger(r),this.infinity=new ot(this,null,null)}equals(n){return n===this?!0:this.q.equals(n.q)&&this.a.equals(n.a)&&this.b.equals(n.b)}fromBigInteger(n){return new Lt(this.q,n)}decodePointHex(n){if(typeof n!="string"||n.length<2||n.length%2!==0)return null;switch(parseInt(n.substr(0,2),16)){case 0:return n.length!==2?null:this.infinity;case 2:case 3:if(n.length!==66)return null;let o=this.fromBigInteger(new M(n.substr(2),16)),r=this.fromBigInteger(o.multiply(o.square()).add(o.multiply(this.a)).add(this.b).toBigInteger().modPow(this.q.divide(new M("4")).add(M.ONE),this.q));return r.toBigInteger().mod(ne).equals(new M(n.substr(0,2),16).subtract(ne))||(r=r.negate()),new ot(this,o,r);case 4:case 6:case 7:if(n.length!==130)return null;let h=(n.length-2)/2,l=n.substr(2,h),d=n.substr(h+2,h);return new ot(this,this.fromBigInteger(new M(l,16)),this.fromBigInteger(new M(d,16)));default:return null}}};se.exports={ECPointFp:ot,ECCurveFp:Nt}});var he=_((Kn,ft)=>{var Et,k,O,Vt=class{constructor(){this.i=0,this.j=0,this.S=[]}init(n){let o,r,h;for(o=0;o<256;++o)this.S[o]=o;for(r=0,o=0;o<256;++o)r=r+this.S[o]+n[o%n.length]&255,h=this.S[o],this.S[o]=this.S[r],this.S[r]=h;this.i=0,this.j=0}next(){this.i=this.i+1&255,this.j=this.j+this.S[this.i]&255;let n=this.S[this.i];return this.S[this.i]=this.S[this.j],this.S[this.j]=n,this.S[n+this.S[this.i]&255]}};function cn(s){k[O++]^=s&255,k[O++]^=s>>8&255,k[O++]^=s>>16&255,k[O++]^=s>>24&255,O>=256&&(O-=256)}function fe(){cn(new Date().getTime())}if(k==null){k=[],O=0;let s,n=new Uint8Array(32);if(typeof window!="undefined"&&window.crypto&&window.crypto.getRandomValues)for(window.crypto.getRandomValues(n),s=0;s<32;++s)k[O++]=n[s];else{let o=typeof ft!="undefined"&&typeof ft.require=="function"?ft.require.bind(ft):null,r=o?o("crypto"):null;if(r)r.getRandomValues(n);else if(globalThis.crypto)globalThis.crypto.getRandomValues(n);else throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301 crypto.getRandomValues\uFF01");for(s=0;s<32;++s)k[O++]=n[s]}O=0,fe()}function an(){if(Et==null){for(fe(),Et=new Vt,Et.init(k),O=0;O<k.length;++O)k[O]=0;O=0}return Et.next()}var zt=class{nextBytes(n){for(let o=0;o<n.length;++o)n[o]=an()}};ft.exports={SecureRandom:zt}});var ae=_((Xn,ce)=>{var{BigInteger:Z}=at(),{ECCurveFp:xn}=oe(),{SecureRandom:pn}=he(),dn=new pn,{curve:ht,G:gn,n:ue}=le();function mn(){return ht}function le(){let s=new Z("FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF",16),n=new Z("FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC",16),o=new Z("28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93",16),r=new xn(s,n,o),d=r.decodePointHex("04"+"32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7"+"BC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0"),b=new Z("FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123",16);return{curve:r,G:d,n:b}}function yn(s,n,o){let h=(s?new Z(s,n,o):new Z(ue.bitLength(),dn)).mod(ue.subtract(Z.ONE)).add(Z.ONE),l=xt(h.toString(16),64),d=gn.multiply(h),b=xt(d.getX().toBigInteger().toString(16),64),p=xt(d.getY().toBigInteger().toString(16),64),F="04"+b+p;return{privateKey:l,publicKey:F}}function vn(s){if(s.length!==130)throw new Error("Invalid public key to compress");let n=(s.length-2)/2,o=s.substr(2,n),r=new Z(s.substr(n+2,n),16),h="03";return r.mod(new Z("2")).equals(Z.ZERO)&&(h="02"),h+o}function wn(s){s=unescape(encodeURIComponent(s));let n=s.length,o=[];for(let h=0;h<n;h++)o[h>>>2]|=(s.charCodeAt(h)&255)<<24-h%4*8;let r=[];for(let h=0;h<n;h++){let l=o[h>>>2]>>>24-h%4*8&255;r.push((l>>>4).toString(16)),r.push((l&15).toString(16))}return r.join("")}function xt(s,n){return s.length>=n?s:new Array(n-s.length+1).join("0")+s}function bn(s){let n=[];for(let o=0;o<s.length;o++){let r=s[o]&255;n.push((r>>>4).toString(16)),n.push((r&15).toString(16))}return n.join("")}function Tn(s){let n=[],o=0;for(let r=0;r<s.length*2;r+=2)n[r>>>3]|=parseInt(s[o],10)<<24-r%8*4,o++;try{let r=[];for(let h=0;h<s.length;h++){let l=n[h>>>2]>>>24-h%4*8&255;r.push(String.fromCharCode(l))}return decodeURIComponent(escape(r.join("")))}catch(r){throw new Error("Malformed UTF-8 data")}}function Fn(s){let n=[],o=s.length;o%2!==0&&(s=xt(s,o+1)),o=s.length;for(let r=0;r<o;r+=2)n.push(parseInt(s.substr(r,2),16));return n}function jt(s){if(typeof s!="string"||!s)return!1;let n;try{n=ht.decodePointHex(s)}catch(h){return!1}if(!n||n.isInfinity())return!1;let o=n.getX();return n.getY().square().equals(o.multiply(o.square()).add(o.multiply(ht.a)).add(ht.b))}function Bn(s,n){if(!jt(s)||!jt(n))return!1;let o=ht.decodePointHex(s),r=ht.decodePointHex(n);return o.equals(r)}ce.exports={getGlobalCurve:mn,generateEcparam:le,generateKeyPairHex:yn,compressPublicKeyHex:vn,utf8ToHex:wn,leftPad:xt,arrayToHex:bn,arrayToUtf8:Tn,hexToArray:Fn,verifyPublicKey:jt,comparePublicKeyHex:Bn}});var kt=_((Qn,ge)=>{var Y=new Uint32Array(68),Ut=new Uint32Array(64);function V(s,n){let o=n&31;return s<<o|s>>>32-o}function xe(s,n){let o=[];for(let r=s.length-1;r>=0;r--)o[r]=(s[r]^n[r])&255;return o}function En(s){return s^V(s,9)^V(s,17)}function Sn(s){return s^V(s,15)^V(s,23)}function St(s){let n=s.length*8,o=n%512;o=o>=448?512-o%448-1:448-o-1;let r=new Array((o-7)/8),h=new Array(8);for(let g=0,m=r.length;g<m;g++)r[g]=0;for(let g=0,m=h.length;g<m;g++)h[g]=0;n=n.toString(2);for(let g=7;g>=0;g--)if(n.length>8){let m=n.length-8;h[g]=parseInt(n.substr(m),2),n=n.substr(0,m)}else n.length>0&&(h[g]=parseInt(n,2),n="");let l=new Uint8Array([...s,128,...r,...h]),d=new DataView(l.buffer,0),b=l.length/64,p=new Uint32Array([1937774191,1226093241,388252375,3666478592,2842636476,372324522,3817729613,2969243214]);for(let g=0;g<b;g++){Y.fill(0),Ut.fill(0);let m=16*g;for(let B=0;B<16;B++)Y[B]=d.getUint32((m+B)*4,!1);for(let B=16;B<68;B++)Y[B]=Sn(Y[B-16]^Y[B-9]^V(Y[B-3],15))^V(Y[B-13],7)^Y[B-6];for(let B=0;B<64;B++)Ut[B]=Y[B]^Y[B+4];let y=2043430169,w=2055708042,T=p[0],S=p[1],q=p[2],A=p[3],D=p[4],G=p[5],K=p[6],J=p[7],$,dt,gt,tt,mt;for(let B=0;B<64;B++)mt=B>=0&&B<=15?y:w,$=V(V(T,12)+D+V(mt,B),7),dt=$^V(T,12),gt=(B>=0&&B<=15?T^S^q:T&S|T&q|S&q)+A+dt+Ut[B],tt=(B>=0&&B<=15?D^G^K:D&G|~D&K)+J+$+Y[B],A=q,q=V(S,9),S=T,T=gt,J=K,K=V(G,19),G=D,D=En(tt);p[0]^=T,p[1]^=S,p[2]^=q,p[3]^=A,p[4]^=D,p[5]^=G,p[6]^=K,p[7]^=J}let F=[];for(let g=0,m=p.length;g<m;g++){let y=p[g];F.push((y&4278190080)>>>24,(y&16711680)>>>16,(y&65280)>>>8,y&255)}return F}var pt=64,pe=new Uint8Array(pt),de=new Uint8Array(pt);for(let s=0;s<pt;s++)pe[s]=54,de[s]=92;function Dn(s,n){for(n.length>pt&&(n=St(n));n.length<pt;)n.push(0);let o=xe(n,pe),r=xe(n,de),h=St([...o,...s]);return St([...r,...h])}ge.exports={sm3:St,hmac:Dn}});var Fe=_((Wn,Te)=>{var{BigInteger:P}=at(),{encodeDer:Rn,decodeDer:In}=ie(),v=ae(),ut=kt().sm3,{G:rt,curve:me,n:st}=v.generateEcparam(),ye=0;function qn(s,n,o=1){if(!v.verifyPublicKey(n))throw new Error("Invalid public key");s=typeof s=="string"?v.hexToArray(v.utf8ToHex(s)):Array.prototype.slice.call(s),n=v.getGlobalCurve().decodePointHex(n);let r=v.generateKeyPairHex(),h=new P(r.privateKey,16),l=r.publicKey;l.length>128&&(l=l.substr(l.length-128));let d=n.multiply(h),b=v.hexToArray(v.leftPad(d.getX().toBigInteger().toRadix(16),64)),p=v.hexToArray(v.leftPad(d.getY().toBigInteger().toRadix(16),64)),F=v.arrayToHex(ut([].concat(b,s,p))),g=1,m=0,y=[],w=[].concat(b,p),T=()=>{y=ut([...w,g>>24&255,g>>16&255,g>>8&255,g&255]),g++,m=0};T();for(let q=0,A=s.length;q<A;q++)m===y.length&&T(),s[q]^=y[m++]&255;let S=v.arrayToHex(s);return o===ye?l+S+F:l+F+S}function Pn(s,n,o=1,{output:r="string"}={}){n=new P(n,16);let h=s.substr(128,64),l=s.substr(192);o===ye&&(h=s.substr(s.length-64),l=s.substr(128,s.length-128-64));let d=v.hexToArray(l),b=v.getGlobalCurve().decodePointHex("04"+s.substr(0,128));if(!b||!v.verifyPublicKey("04"+s.substr(0,128)))return r==="array"?[]:"";let p=b.multiply(n),F=v.hexToArray(v.leftPad(p.getX().toBigInteger().toRadix(16),64)),g=v.hexToArray(v.leftPad(p.getY().toBigInteger().toRadix(16),64)),m=1,y=0,w=[],T=[].concat(F,g),S=()=>{w=ut([...T,m>>24&255,m>>16&255,m>>8&255,m&255]),m++,y=0};S();for(let A=0,D=d.length;A<D;A++)y===w.length&&S(),d[A]^=w[y++]&255;return v.arrayToHex(ut([].concat(F,d,g)))===h.toLowerCase()?r==="array"?d:v.arrayToUtf8(d):r==="array"?[]:""}function An(s,n,{pointPool:o,der:r,hash:h=!0,publicKey:l,userId:d}={}){let b=typeof s=="string"?v.utf8ToHex(s):v.arrayToHex(Array.prototype.slice.call(s));h&&(l=l||we(n),b=ve(b,l,d));let p=new P(n,16),F=new P(b,16),g=null,m=null,y=null;do{do{let w;o&&o.length?w=o.pop():w=be(),g=w.k,m=F.add(w.x1).mod(st)}while(m.equals(P.ZERO)||m.add(g).equals(st));y=p.add(P.ONE).modInverse(st).multiply(g.subtract(m.multiply(p))).mod(st)}while(y.equals(P.ZERO));return r?Rn(m,y):v.leftPad(m.toString(16),64)+v.leftPad(y.toString(16),64)}function Cn(s,n,o,{der:r,hash:h=!0,userId:l}={}){if(!v.verifyPublicKey(o))return!1;let d=typeof s=="string"?v.utf8ToHex(s):v.arrayToHex(Array.prototype.slice.call(s));h&&(d=ve(d,o,l));let b,p;if(r)try{let S=In(n);b=S.r,p=S.s}catch(S){return!1}else b=new P(n.substring(0,64),16),p=new P(n.substring(64),16);let F=st.subtract(P.ONE);if(b.compareTo(P.ONE)<0||b.compareTo(F)>0||p.compareTo(P.ONE)<0||p.compareTo(F)>0)return!1;let g=me.decodePointHex(o);if(!g)return!1;let m=new P(d,16),y=b.add(p).mod(st);if(y.equals(P.ZERO))return!1;let w=rt.multiply(p).add(g.multiply(y)),T=m.add(w.getX().toBigInteger()).mod(st);return b.equals(T)}function ve(s,n,o="1234567812345678"){o=v.utf8ToHex(o);let r=v.leftPad(rt.curve.a.toBigInteger().toRadix(16),64),h=v.leftPad(rt.curve.b.toBigInteger().toRadix(16),64),l=v.leftPad(rt.getX().toBigInteger().toRadix(16),64),d=v.leftPad(rt.getY().toBigInteger().toRadix(16),64),b,p;if(n.length===128)b=n.substr(0,64),p=n.substr(64,64);else{let y=rt.curve.decodePointHex(n);b=v.leftPad(y.getX().toBigInteger().toRadix(16),64),p=v.leftPad(y.getY().toBigInteger().toRadix(16),64)}let F=v.hexToArray(o+r+h+l+d+b+p),g=o.length*4;F.unshift(g&255),F.unshift(g>>8&255);let m=ut(F);return v.arrayToHex(ut(m.concat(v.hexToArray(s))))}function we(s){let n=rt.multiply(new P(s,16)),o=v.leftPad(n.getX().toBigInteger().toString(16),64),r=v.leftPad(n.getY().toBigInteger().toString(16),64);return"04"+o+r}function be(){let s=v.generateKeyPairHex(),n=me.decodePointHex(s.publicKey);return s.k=new P(s.privateKey,16),s.x1=n.getX().toBigInteger(),s}Te.exports={generateKeyPairHex:v.generateKeyPairHex,compressPublicKeyHex:v.compressPublicKeyHex,comparePublicKeyHex:v.comparePublicKeyHex,doEncrypt:qn,doDecrypt:Pn,doSignature:An,doVerifySignature:Cn,getPublicKeyFromPrivateKey:we,getPoint:be,verifyPublicKey:v.verifyPublicKey}});var Se=_((Jn,Ee)=>{var{sm3:Mn,hmac:On}=kt();function Hn(s,n){return s.length>=n?s:new Array(n-s.length+1).join("0")+s}function Be(s){return s.map(n=>(n=n.toString(16),n.length===1?"0"+n:n)).join("")}function Ln(s){let n=[],o=s.length;o%2!==0&&(s=Hn(s,o+1)),o=s.length;for(let r=0;r<o;r+=2)n.push(parseInt(s.substr(r,2),16));return n}function Nn(s){let n=[];for(let o=0,r=s.length;o<r;o++){let h=s.codePointAt(o);if(h<=127)n.push(h);else if(h<=2047)n.push(192|h>>>6),n.push(128|h&63);else if(h<=55295||h>=57344&&h<=65535)n.push(224|h>>>12),n.push(128|h>>>6&63),n.push(128|h&63);else if(h>=65536&&h<=1114111)o++,n.push(240|h>>>18&28),n.push(128|h>>>12&63),n.push(128|h>>>6&63),n.push(128|h&63);else throw n.push(h),new Error("input is not supported")}return n}Ee.exports=function(s,n){if(s=typeof s=="string"?Nn(s):Array.prototype.slice.call(s),n){if((n.mode||"hmac")!=="hmac")throw new Error("invalid mode");let r=n.key;if(!r)throw new Error("invalid key");return r=typeof r=="string"?Ln(r):Array.prototype.slice.call(r),Be(On(s,r))}return Be(Mn(s))}});var Ie=_(($n,Re)=>{var Dt=[214,144,233,254,204,225,61,183,22,182,20,194,40,251,44,5,43,103,154,118,42,190,4,195,170,68,19,38,73,134,6,153,156,66,80,244,145,239,152,122,51,84,11,67,237,207,172,98,228,179,28,169,201,8,232,149,128,223,148,250,117,143,63,166,71,7,167,252,243,115,23,186,131,89,60,25,230,133,79,168,104,107,129,178,113,100,218,139,248,235,15,75,112,86,157,53,30,36,14,94,99,88,209,162,37,34,124,59,1,33,120,135,212,0,70,87,159,211,39,82,76,54,2,231,160,196,200,158,234,191,138,210,64,199,56,181,163,247,242,206,249,97,21,161,224,174,93,164,155,52,26,85,173,147,50,48,245,140,177,227,29,246,226,46,130,102,202,96,192,41,35,171,13,83,78,111,213,219,55,69,222,253,142,47,3,255,106,114,109,108,91,81,141,27,175,146,187,221,188,127,17,217,92,65,31,16,90,216,10,193,49,136,165,205,123,189,45,116,208,18,184,229,180,176,137,105,151,74,12,150,119,126,101,185,241,9,197,110,198,132,24,240,125,236,58,220,77,32,121,238,95,62,215,203,57,72],Rt=[462357,472066609,943670861,1415275113,1886879365,2358483617,2830087869,3301692121,3773296373,4228057617,404694573,876298825,1347903077,1819507329,2291111581,2762715833,3234320085,3705924337,4177462797,337322537,808926789,1280531041,1752135293,2223739545,2695343797,3166948049,3638552301,4110090761,269950501,741554753,1213159005,1684763257];function Zt(s){let n=[];for(let o=0,r=s.length;o<r;o+=2)n.push(parseInt(s.substr(o,2),16));return n}function Vn(s){return s.map(n=>(n=n.toString(16),n.length===1?"0"+n:n)).join("")}function zn(s){let n=[];for(let o=0,r=s.length;o<r;o++){let h=s.codePointAt(o);if(h<=127)n.push(h);else if(h<=2047)n.push(192|h>>>6),n.push(128|h&63);else if(h<=55295||h>=57344&&h<=65535)n.push(224|h>>>12),n.push(128|h>>>6&63),n.push(128|h&63);else if(h>=65536&&h<=1114111)o++,n.push(240|h>>>18&28),n.push(128|h>>>12&63),n.push(128|h>>>6&63),n.push(128|h&63);else throw n.push(h),new Error("input is not supported")}return n}function jn(s){let n=[];for(let o=0,r=s.length;o<r;o++)s[o]>=240&&s[o]<=247?(n.push(String.fromCodePoint(((s[o]&7)<<18)+((s[o+1]&63)<<12)+((s[o+2]&63)<<6)+(s[o+3]&63))),o+=3):s[o]>=224&&s[o]<=239?(n.push(String.fromCodePoint(((s[o]&15)<<12)+((s[o+1]&63)<<6)+(s[o+2]&63))),o+=2):s[o]>=192&&s[o]<=223?(n.push(String.fromCodePoint(((s[o]&31)<<6)+(s[o+1]&63))),o++):n.push(String.fromCodePoint(s[o]));return n.join("")}function lt(s,n){let o=n&31;return s<<o|s>>>32-o}function W(s){return(Dt[s>>>24&255]&255)<<24|(Dt[s>>>16&255]&255)<<16|(Dt[s>>>8&255]&255)<<8|Dt[s&255]&255}function It(s){return s^lt(s,2)^lt(s,10)^lt(s,18)^lt(s,24)}function qt(s){return s^lt(s,13)^lt(s,23)}function Un(s,n,o){let r=new Array(4),h=new Array(4);for(let l=0;l<4;l++)h[0]=s[4*l]&255,h[1]=s[4*l+1]&255,h[2]=s[4*l+2]&255,h[3]=s[4*l+3]&255,r[l]=h[0]<<24|h[1]<<16|h[2]<<8|h[3];for(let l=0,d;l<32;l+=4)d=r[1]^r[2]^r[3]^o[l+0],r[0]^=It(W(d)),d=r[2]^r[3]^r[0]^o[l+1],r[1]^=It(W(d)),d=r[3]^r[0]^r[1]^o[l+2],r[2]^=It(W(d)),d=r[0]^r[1]^r[2]^o[l+3],r[3]^=It(W(d));for(let l=0;l<16;l+=4)n[l]=r[3-l/4]>>>24&255,n[l+1]=r[3-l/4]>>>16&255,n[l+2]=r[3-l/4]>>>8&255,n[l+3]=r[3-l/4]&255}function kn(s,n,o){let r=new Array(4),h=new Array(4);for(let l=0;l<4;l++)h[0]=s[0+4*l]&255,h[1]=s[1+4*l]&255,h[2]=s[2+4*l]&255,h[3]=s[3+4*l]&255,r[l]=h[0]<<24|h[1]<<16|h[2]<<8|h[3];r[0]^=2746333894,r[1]^=1453994832,r[2]^=1736282519,r[3]^=2993693404;for(let l=0,d;l<32;l+=4)d=r[1]^r[2]^r[3]^Rt[l+0],n[l+0]=r[0]^=qt(W(d)),d=r[2]^r[3]^r[0]^Rt[l+1],n[l+1]=r[1]^=qt(W(d)),d=r[3]^r[0]^r[1]^Rt[l+2],n[l+2]=r[2]^=qt(W(d)),d=r[0]^r[1]^r[2]^Rt[l+3],n[l+3]=r[3]^=qt(W(d));if(o===0)for(let l=0,d;l<16;l++)d=n[l],n[l]=n[31-l],n[31-l]=d}function De(s,n,o,{padding:r="pkcs#7",mode:h,iv:l=[],output:d="string"}={}){if(h==="cbc"&&(typeof l=="string"&&(l=Zt(l)),l.length!==128/8))throw new Error("iv is invalid");if(typeof n=="string"&&(n=Zt(n)),n.length!==128/8)throw new Error("key is invalid");if(typeof s=="string"?o!==0?s=zn(s):s=Zt(s):s=[...s],(r==="pkcs#5"||r==="pkcs#7")&&o!==0){let y=16-s.length%16;for(let w=0;w<y;w++)s.push(y)}let b=new Array(32);kn(n,b,o);let p=[],F=l,g=s.length,m=0;for(;g>=16;){let y=s.slice(m,m+16),w=new Array(16);if(h==="cbc")for(let T=0;T<16;T++)o!==0&&(y[T]^=F[T]);Un(y,w,b);for(let T=0;T<16;T++)h==="cbc"&&o===0&&(w[T]^=F[T]),p[m+T]=w[T];h==="cbc"&&(o!==0?F=w:F=y),g-=16,m+=16}if((r==="pkcs#5"||r==="pkcs#7")&&o===0){let y=p.length,w=p[y-1];for(let T=1;T<=w;T++)if(p[y-T]!==w)throw new Error("padding is invalid");p.splice(y-w,w)}return d!=="array"?o!==0?Vn(p):jn(p):p}Re.exports={encrypt(s,n,o){return De(s,n,1,o)},decrypt(s,n,o){return De(s,n,0,o)}}});var Zn=_((tr,qe)=>{qe.exports={sm2:Fe(),sm3:Se(),sm4:Ie()}});return Zn();})();
  // ==================== 性能打点 ====================
  let _profiling = false;
  let _marks = [];
  let _lastProfile = null;

  function mark(label, tag) {
    if (!_profiling) return;
    _marks.push({ label, tag: tag || "", t: performance.now() });
  }
  function flushProfile(title, tag) {
    const tagFilter = tag || "";
    const my = tagFilter ? _marks.filter((m) => m.tag === tagFilter) : _marks;
    const rows = [];
    for (let i = 0; i < my.length; i++) {
      const cur = my[i];
      const prev = i > 0 ? my[i - 1] : null;
      rows.push({
        阶段: cur.label,
        增量ms: +(cur.t - (prev ? prev.t : cur.t)).toFixed(1),
        累计ms: +(cur.t - my[0].t).toFixed(1),
      });
    }
    const name = title ? "[" + title + "] " : "";
    if (typeof console !== "undefined" && console.table) {
      console.log("%c" + name + "耗时打点", "color:#4B3FE3;font-weight:bold");
      console.table(rows);
    }
    _lastProfile = { title: title || "", rows };
    if (tagFilter) _marks = _marks.filter((m) => m.tag !== tagFilter);
    else _marks = [];
    return rows;
  }

  // ==================== XML 节点工具 ====================
  function stripNs(tag) {
    const c = tag.indexOf(":");
    return c >= 0 ? tag.slice(c + 1) : tag;
  }
  function child(parent, name) {
    if (!parent || !parent.children) return null;
    for (const c of parent.children) {
      if (stripNs(c.tag) === name) return c;
    }
    return null;
  }
  function children(parent, name) {
    const out = [];
    if (!parent || !parent.children) return out;
    for (const c of parent.children) {
      if (stripNs(c.tag) === name) out.push(c);
    }
    return out;
  }
  function text(node) {
    return node ? (node.text || "").trim() : "";
  }
  function attr(el, name) {
    return el && el.attrs[name] != null ? el.attrs[name] : null;
  }
  function num(el, name, dflt) {
    const v = attr(el, name);
    if (v === null || v === "") return dflt;
    const n = parseFloat(v);
    return isFinite(n) ? n : dflt;
  }
  function bool(el, name, dflt) {
    const v = attr(el, name);
    if (v === null || v === "") return dflt;
    return v === "true" || v === "1";
  }

  function parseBox(str) {
    if (!str) return { x: 0, y: 0, w: 0, h: 0 };
    const p = str.trim().split(/\s+/).map(Number);
    return { x: p[0] || 0, y: p[1] || 0, w: p[2] || 0, h: p[3] || 0 };
  }
  function parseMatrix(str) {
    if (!str) return null;
    const p = str.trim().split(/\s+/).map(Number);
    return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] || 0, p[4] || 0, p[5] || 0];
  }

  // ==================== 路径 ====================
  function dirOf(path) {
    const i = path.lastIndexOf("/");
    return i >= 0 ? path.slice(0, i) : "";
  }
  function resolvePath(base, rel) {
    if (!rel) return rel;
    if (/^[a-zA-Z]+:\/\//.test(rel) || rel.startsWith("/"))
      return rel.replace(/^\//, "");
    const parts = (dirOf(base) ? dirOf(base) + "/" : "") + rel;
    const segs = parts.split("/");
    const out = [];
    for (const s of segs) {
      if (s === "." || s === "") continue;
      if (s === "..") out.pop();
      else out.push(s);
    }
    return out.join("/");
  }

  // ==================== 颜色 ====================
  // "156 82 35" | "#9C5223" | "#ee #20 #25" | "255"(灰度)
  function parseColor(el) {
    if (!el) return null;
    const val = attr(el, "Value");
    const alpha = attr(el, "Alpha");
    let a = 1;
    if (alpha !== null && alpha !== "")
      a = Math.max(0, Math.min(1, parseFloat(alpha) / 255));
    if (!val) return { r: 0, g: 0, b: 0, a };
    const parts = val.trim().split(/\s+/);
    if (parts.length === 1) {
      if (parts[0].startsWith("#")) {
        const hex = parts[0].slice(1);
        const full =
          hex.length === 3
            ? hex
                .split("")
                .map((c) => c + c)
                .join("")
            : hex;
        const n = parseInt(full, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
      }
      const g = parseInt(parts[0]);
      return { r: g, g: g, b: g, a };
    }
    // 多分量：可能是 "156 82 35" 或 "#ee #20 #25"
    const parseComp = (s) => {
      if (s.startsWith("#")) {
        const v = parseInt(s.slice(1), 16);
        return isNaN(v) ? 0 : v;
      }
      const v = parseInt(s);
      return isNaN(v) ? 0 : v;
    };
    return {
      r: parseComp(parts[0]),
      g: parseComp(parts[1]),
      b: parseComp(parts[2]),
      a,
    };
  }
  const _colorCache = new Map();
  function colorToCss(c) {
    if (!c) return "#000";
    const key = c.r + "," + c.g + "," + c.b + "," + c.a;
    let css = _colorCache.get(key);
    if (css !== undefined) return css;
    css =
      c.a < 1
        ? `rgba(${c.r},${c.g},${c.b},${c.a})`
        : `rgb(${c.r},${c.g},${c.b})`;
    if (_colorCache.size >= 256) _colorCache.clear(); // 简单防膨胀
    _colorCache.set(key, css);
    return css;
  }

  // ==================== XML 解析器 ====================
  // 节点 { tag, attrs, children, text }，无 DOM 中间产物，浏览器/Node 通用
  function parseXml(str) {
    const root = { tag: "#root", attrs: {}, children: [], text: "" };
    const stack = [root];
    let i = 0;
    const n = str.length;
    while (i < n) {
      const lt = str.indexOf("<", i);
      const cur = stack[stack.length - 1];
      if (lt < 0) {
        cur.text += decodeEntities(str.slice(i));
        break;
      }
      if (lt > i) cur.text += decodeEntities(str.slice(i, lt));
      if (str[lt + 1] === "!" && str.startsWith("<![CDATA[", lt)) {
        const end = str.indexOf("]]>", lt + 9);
        cur.text += str.slice(lt + 9, end < 0 ? n : end);
        i = end < 0 ? n : end + 3;
        continue;
      }
      if (str[lt + 1] === "?" || (str[lt + 1] === "!" && str[lt + 2] !== "[")) {
        // XML 声明 / 注释 / DOCTYPE：跳到对应结束标记
        const close = str.startsWith("<!--", lt) ? "-->" : ">";
        const end = str.indexOf(close, lt + 2);
        i = end < 0 ? n : end + close.length;
        continue;
      }
      if (str[lt + 1] === "/") {
        // 闭合标签：校验与栈顶匹配后弹出
        const gt = str.indexOf(">", lt);
        const name = str.slice(lt + 2, gt < 0 ? n : gt).trim();
        const top = stack[stack.length - 1];
        if (stack.length > 1 && name && stripNs(top.tag) !== stripNs(name)) {
          throw new Error(
            "XML 解析错误: 标签不匹配 <" +
              top.tag +
              "> 与 </" +
              name +
              ">（位置 " +
              lt +
              "）",
          );
        }
        stack.pop();
        i = gt < 0 ? n : gt + 1;
        continue;
      }
      // 开始标签
      const r = parseStartTag(str, lt);
      const node = { tag: r.name, attrs: r.attrs, children: [], text: "" };
      stack[stack.length - 1].children.push(node);
      if (!r.selfClosing) stack.push(node);
      i = r.end;
    }
    const el = root.children[0];
    if (!el) throw new Error("XML 解析错误: 无根元素");
    return { documentElement: el };
  }

  function _isSpace(c) {
    const cc = c.charCodeAt(0);
    return cc === 32 || cc === 9 || cc === 10 || cc === 13;
  }
  function _isNameEnd(c) {
    return c === ">" || c === "/" || _isSpace(c);
  }
  function _isAttrEnd(c) {
    return c === "=" || c === ">" || c === "/" || _isSpace(c);
  }
  function _isValEnd(c) {
    return c === ">" || _isSpace(c);
  }

  function parseStartTag(str, start) {
    const n = str.length;
    let i = start + 1;
    let name = "";
    while (i < n && !_isNameEnd(str[i])) {
      name += str[i];
      i++;
    }
    const attrs = {};
    let selfClosing = false;
    while (i < n) {
      while (i < n && _isSpace(str[i])) i++;
      if (i >= n) break;
      const ch = str[i];
      if (ch === ">") {
        i++;
        break;
      }
      if (ch === "/") {
        selfClosing = true;
        i++;
        if (str[i] === ">") i++;
        break;
      }
      let an = "";
      while (i < n && !_isAttrEnd(str[i])) {
        an += str[i];
        i++;
      }
      while (i < n && _isSpace(str[i])) i++;
      if (i < n && str[i] === "=") {
        i++;
        while (i < n && _isSpace(str[i])) i++;
        if (i < n && (str[i] === '"' || str[i] === "'")) {
          const q = str[i];
          const qe = str.indexOf(q, i + 1);
          attrs[an] = decodeEntities(str.slice(i + 1, qe < 0 ? n : qe));
          i = qe < 0 ? n : qe + 1;
        } else {
          let v = "";
          while (i < n && !_isValEnd(str[i])) {
            v += str[i];
            i++;
          }
          attrs[an] = decodeEntities(v);
        }
      } else if (an) {
        attrs[an] = ""; // 无值属性（布尔属性）
      }
    }
    return { name, attrs, selfClosing, end: i };
  }

  // XML 实体解码：5 个预定义实体 + 十进制/十六进制字符引用
  function decodeEntities(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
      switch (e) {
        case "amp":
          return "&";
        case "lt":
          return "<";
        case "gt":
          return ">";
        case "quot":
          return '"';
        case "apos":
          return "'";
        default: {
          const cp =
            e[1] === "x" || e[1] === "X"
              ? parseInt(e.slice(2), 16)
              : parseInt(e.slice(1), 10);
          // 码点合法性校验：代理区与超 Unicode 上限的畸形引用返回 U+FFFD，
          // 避免 String.fromCodePoint 抛 RangeError 中断整个解析
          if (
            !isFinite(cp) ||
            cp < 0 ||
            cp > 0x10ffff ||
            (cp >= 0xd800 && cp <= 0xdfff)
          )
            return "\uFFFD";
          return String.fromCodePoint(cp);
        }
      }
    });
  }

  // XML 转义：与 decodeEntities 互逆，只处理 5 个预定义实体
  const _xmlEscapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (c) => _xmlEscapeMap[c]);
  }

  // DeltaX/DeltaY: "v1 v2 ..." | "g N V ..."（g=重复N次取值V）
  function expandDelta(str) {
    if (!str) return [];
    const tokens = str.trim().split(/\s+/);
    const result = [];
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "g" || t === "G") {
        const n = parseInt(tokens[i + 1], 10);
        const v = parseFloat(tokens[i + 2]);
        for (let j = 0; j < n; j++) result.push(v);
        i += 3;
      } else {
        result.push(parseFloat(t));
        i += 1;
      }
    }
    return result;
  }

  // ==================== 通用数据结构 ====================
  // LRU 缓存：SVG 页面缓存、ZIP 条目缓存、路径缩写缓存共用。
  // class 不提升，故定义必须早于所有构造点。
  class LRUCache {
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

  // ==================== ZIP 解压 ====================
  const _utf8Decoder = new TextDecoder("utf-8");

  // 单条目解压后体积上限（256MB），用于阻断 ZIP 炸弹；OFD 内单个资源远超此值即属异常
  const MAX_UNCOMPRESSED_SIZE = 256 * 1024 * 1024;
  // ZIP 条目缓存上限（条目数），避免大文档 / 多图文档内存无限膨胀
  const ZIP_ENTRY_CACHE_MAX = 64;

  async function readZip(data) {
    if (!(data instanceof Uint8Array)) data = new Uint8Array(data);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const len = data.byteLength;
    // 查找 End of Central Directory 记录
    let eocd = -1;
    for (let i = len - 22; i >= 0 && i >= len - 22 - 65535; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("无效的 OFD/ZIP 文件：未找到 EOCD");
    if (view.getUint32(eocd + 16, true) === 0xffffffff) {
      throw new Error("暂不支持 ZIP64 格式的 OFD 文件");
    }
    const cdEntries = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);
    const entries = Object.create(null);
    let off = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
      if (view.getUint32(off, true) !== 0x02014b50) break;
      const compMethod = view.getUint16(off + 10, true);
      const compSize = view.getUint32(off + 20, true);
      const uncompSize = view.getUint32(off + 24, true);
      const nameLen = view.getUint16(off + 28, true);
      const extraLen = view.getUint16(off + 30, true);
      const commentLen = view.getUint16(off + 32, true);
      const localOff = view.getUint32(off + 42, true);
      const nameBytes = data.subarray(off + 46, off + 46 + nameLen);
      const name = _utf8Decoder.decode(nameBytes);
      entries[name] = { compMethod, compSize, uncompSize, localOff };
      off += 46 + nameLen + extraLen + commentLen;
    }
    return { data, view, entries, cache: new LRUCache(ZIP_ENTRY_CACHE_MAX) };
  }

  async function readEntry(zip, name) {
    if (!zip) return null;
    if (zip.cache && zip.cache.has(name)) return zip.cache.get(name);
    const e = zip.entries[name];
    if (!e) return null;
    const lOff = e.localOff;
    const nameLen = zip.view.getUint16(lOff + 26, true);
    const extraLen = zip.view.getUint16(lOff + 28, true);
    const dataStart = lOff + 30 + nameLen + extraLen;
    const compressed = zip.data.subarray(dataStart, dataStart + e.compSize);
    let result = null;
    if (e.compMethod === 0) {
      result = compressed;
    } else if (e.compMethod === 8) {
      // 先按声明体积拦截；uncompSize 可能与实际不符，解压后再按真实体积校验一次
      if (e.uncompSize > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(
          "ZIP 条目声明解压体积过大（" +
            e.uncompSize +
            " 字节），已中止以防解压炸弹",
        );
      }
      const ds = new DecompressionStream("deflate-raw");
      const rs = new ReadableStream({
        start(c) {
          c.enqueue(compressed);
          c.close();
        },
      });
      const buf = await new Response(rs.pipeThrough(ds)).arrayBuffer();
      if (buf.byteLength > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(
          "ZIP 条目解压后体积超过上限（" +
            buf.byteLength +
            " 字节），已中止以防解压炸弹",
        );
      }
      result = new Uint8Array(buf);
    } else {
      throw new Error("不支持的压缩方法: " + e.compMethod);
    }
    if (zip.cache) zip.cache.set(name, result);
    return result;
  }

  async function readEntryText(zip, name) {
    const bytes = await readEntry(zip, name);
    if (!bytes) return null;
    return _utf8Decoder.decode(bytes);
  }

  /* ---------- 字节与编码工具（base64 / hex / 比较） ---------- */
  function bytesToBase64(bytes) {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  // base64 → 字节。做三件事以防真实文档里的脏输入直接抛异常：
  //   1) 去空白/NULL —— XML 里的内嵌图像 base64 常带换行；
  //   2) URL-safe 字符 '-' '_' 转回 '+' '/' —— 否则 atob 抛 InvalidCharacterError；
  //   3) 按需补 '=' 填充，并对长度 %4===1 的非法输入显式报错而非静默出错。
  function base64ToBytes(b64) {
    let s = String(b64)
      .replace(/[\s\x00]/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    else if (pad === 1) throw new Error("base64 长度非法");
    let bin;
    if (typeof atob === "function") {
      bin = atob(s);
    } else {
      // 兜底实现（无 atob 的环境），'=' 视为组内结束
      const table =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      const eq = "=".charCodeAt(0);
      bin = "";
      for (let i = 0; i < s.length; i += 4) {
        const c = [s[i], s[i + 1], s[i + 2], s[i + 3]].map((ch) =>
          ch === "=" ? eq : table.indexOf(ch),
        );
        const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
        bin += String.fromCharCode((n >> 16) & 255, (n >> 8) & 255, n & 255);
      }
      const eqs = /\=*$/.exec(s)[0].length;
      if (eqs) bin = bin.slice(0, 3 - eqs);
    }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // 摘要比对。部分国密厂商 SDK（如 Provider="sdt"）会把摘要写入固定长度缓冲区
  // （实测为 128 字节）并在尾部补零，因此 CheckValue 长度可能大于摘要本身。
  // 此时允许「尾部全为 0」的补零形态，只比对前 digest.length 字节。
  function digestMatches(digest, expected) {
    if (bytesEqual(digest, expected)) return true;
    if (expected.length <= digest.length) return false;
    for (let i = digest.length; i < expected.length; i++)
      if (expected[i] !== 0) return false;
    return bytesEqual(digest, expected.subarray(0, digest.length));
  }

  // ==================== SM3 哈希 ====================
  const SM3_IV = new Uint32Array([
    0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa,
    0xe38dee4d, 0xb0fb0e4e,
  ]);
  function sm3Rotl(x, n) {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
  }
  function sm3P0(x) {
    return (x ^ sm3Rotl(x, 9) ^ sm3Rotl(x, 17)) >>> 0;
  }
  function sm3P1(x) {
    return (x ^ sm3Rotl(x, 15) ^ sm3Rotl(x, 23)) >>> 0;
  }
  function sm3FF(x, y, z, j) {
    return j < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (x & z) | (y & z)) >>> 0;
  }
  function sm3GG(x, y, z, j) {
    return j < 16 ? (x ^ y ^ z) >>> 0 : ((x & y) | (~x & z)) >>> 0;
  }
  function sm3Hash(data) {
    const msg = data instanceof Uint8Array ? data : new Uint8Array(data);
    const bitLen = msg.length * 8;
    const rem = msg.length % 64;
    const padLen = rem >= 56 ? 128 - rem : 64 - rem;
    const padded = new Uint8Array(msg.length + padLen);
    padded.set(msg);
    padded[msg.length] = 0x80;
    const pv = new DataView(padded.buffer);
    pv.setUint32(padded.length - 8, 0, false);
    pv.setUint32(padded.length - 4, bitLen >>> 0, false);

    const V = SM3_IV.slice();
    const W = new Uint32Array(68);
    const Wp = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let t = 0; t < 16; t++) {
        const i = off + t * 4;
        W[t] =
          ((padded[i] << 24) |
            (padded[i + 1] << 16) |
            (padded[i + 2] << 8) |
            padded[i + 3]) >>>
          0;
      }
      for (let t = 16; t < 68; t++) {
        W[t] =
          (sm3P1(W[t - 16] ^ W[t - 9] ^ sm3Rotl(W[t - 3], 15)) ^
            sm3Rotl(W[t - 13], 7) ^
            W[t - 6]) >>>
          0;
      }
      for (let t = 0; t < 64; t++) Wp[t] = (W[t] ^ W[t + 4]) >>> 0;

      let a = V[0],
        b = V[1],
        c = V[2],
        d = V[3];
      let e = V[4],
        f = V[5],
        g = V[6],
        h = V[7];
      for (let t = 0; t < 64; t++) {
        const T = t < 16 ? 0x79cc4519 : 0x7a879d8a;
        const ss1 = sm3Rotl((sm3Rotl(a, 12) + e + sm3Rotl(T, t)) >>> 0, 7);
        const ss2 = (ss1 ^ sm3Rotl(a, 12)) >>> 0;
        const tt1 = (sm3FF(a, b, c, t) + d + ss2 + Wp[t]) >>> 0;
        const tt2 = (sm3GG(e, f, g, t) + h + ss1 + W[t]) >>> 0;
        d = c;
        c = sm3Rotl(b, 9);
        b = a;
        a = tt1;
        h = g;
        g = sm3Rotl(f, 19);
        f = e;
        e = sm3P0(tt2);
      }
      V[0] = (V[0] ^ a) >>> 0;
      V[1] = (V[1] ^ b) >>> 0;
      V[2] = (V[2] ^ c) >>> 0;
      V[3] = (V[3] ^ d) >>> 0;
      V[4] = (V[4] ^ e) >>> 0;
      V[5] = (V[5] ^ f) >>> 0;
      V[6] = (V[6] ^ g) >>> 0;
      V[7] = (V[7] ^ h) >>> 0;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    for (let t = 0; t < 8; t++) ov.setUint32(t * 4, V[t], false);
    return out;
  }

  // ==================== 哈希算法 ====================
  async function hashBytes(data, checkMethod) {
    const cm = String(checkMethod || "").toLowerCase();
    if (/sm3|\.401/.test(cm)) return sm3Hash(data);
    let alg = null;
    if (cm.indexOf("sha-256") >= 0 || cm.indexOf("sha256") >= 0)
      alg = "SHA-256";
    else if (cm.indexOf("sha-1") >= 0 || cm.indexOf("sha1") >= 0) alg = "SHA-1";
    else if (cm.indexOf("sha-384") >= 0 || cm.indexOf("sha384") >= 0)
      alg = "SHA-384";
    else if (cm.indexOf("sha-512") >= 0 || cm.indexOf("sha512") >= 0)
      alg = "SHA-512";
    if (!alg) throw new Error("不支持的摘要算法: " + (checkMethod || "未知"));
    const buf = await crypto.subtle.digest(alg, data);
    return new Uint8Array(buf);
  }

  // ==================== ASN.1 / 电子印章 ====================
  function extractSealPicture(bytes) {
    if (!bytes || bytes.length < 10) return null;
    const targets = [
      { type: "ofd", bytes: [0x6f, 0x66, 0x64] }, // "ofd"
      { type: "png", bytes: [0x70, 0x6e, 0x67] }, // "png"
    ];
    for (const target of targets) {
      for (let i = 0; i < bytes.length - target.bytes.length; i++) {
        let match = true;
        for (let j = 0; j < target.bytes.length; j++) {
          if (bytes[i + j] !== target.bytes[j]) {
            match = false;
            break;
          }
        }
        if (!match) continue;
        let strTagOffset = -1;
        let strContentStart = -1;
        let strContentLen = -1;
        if (
          i >= 2 &&
          (bytes[i - 2] === 0x0c || bytes[i - 2] === 0x16) &&
          bytes[i - 1] === target.bytes.length
        ) {
          strTagOffset = i - 2;
          strContentStart = i;
          strContentLen = target.bytes.length;
        }
        if (
          strTagOffset < 0 &&
          i >= 4 &&
          (bytes[i - 4] === 0x0c || bytes[i - 4] === 0x16) &&
          bytes[i - 3] === 0x82
        ) {
          const len = (bytes[i - 2] << 8) | bytes[i - 1];
          if (len === target.bytes.length) {
            strTagOffset = i - 4;
            strContentStart = i;
            strContentLen = target.bytes.length;
          }
        }
        if (strTagOffset < 0) continue;

        let octOffset = strContentStart + strContentLen;
        while (octOffset < bytes.length && bytes[octOffset] !== 0x04)
          octOffset++;
        if (octOffset >= bytes.length) continue;

        octOffset++;
        let octLen, octHeaderLen;
        if (bytes[octOffset] < 0x80) {
          octLen = bytes[octOffset];
          octHeaderLen = 1;
        } else {
          const numBytes = bytes[octOffset] & 0x7f;
          if (numBytes < 1 || numBytes > 4) continue;
          octLen = 0;
          for (let j = 1; j <= numBytes; j++) {
            octLen = (octLen << 8) | bytes[octOffset + j];
          }
          octHeaderLen = 1 + numBytes;
        }
        const octDataStart = octOffset + octHeaderLen;
        if (octDataStart + octLen > bytes.length) continue;
        const octData = bytes.subarray(octDataStart, octDataStart + octLen);

        if (target.type === "ofd") {
          if (octData[0] === 0x50 && octData[1] === 0x4b) {
            return { type: "ofd", data: octData };
          }
        } else if (target.type === "png") {
          if (octData[0] === 0x89 && octData[1] === 0x50) {
            return { type: "png", data: octData };
          }
        }
      }
    }
    return extractSealImageFallback(bytes);
  }

  function extractSealImageFallback(bytes) {
    if (!bytes || bytes.length < 8) return null;
    // PNG
    for (let i = 0; i <= bytes.length - 8; i++) {
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4e &&
        bytes[i + 3] === 0x47
      ) {
        for (let j = bytes.length - 8; j >= i + 4; j--) {
          if (
            bytes[j] === 0x49 &&
            bytes[j + 1] === 0x45 &&
            bytes[j + 2] === 0x4e &&
            bytes[j + 3] === 0x44
          ) {
            return { type: "png", data: bytes.subarray(i, j + 8) };
          }
        }
      }
    }
    // JPEG
    for (let i = 0; i <= bytes.length - 4; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        for (let j = bytes.length - 2; j >= i + 3; j--) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            return { type: "jpeg", data: bytes.subarray(i, j + 2) };
          }
        }
      }
    }
    return null;
  }

  function extractSealName(bytes) {
    if (!bytes || bytes.length < 10) return null;
    let bestStr = null;
    let bestLen = 0;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] !== 0x0c) continue;
      let lenByte = bytes[i + 1];
      let contentLen, headerLen;
      if (lenByte < 0x80) {
        contentLen = lenByte;
        headerLen = 1;
      } else {
        const numBytes = lenByte & 0x7f;
        if (numBytes < 1 || numBytes > 4) continue;
        contentLen = 0;
        for (let j = 1; j <= numBytes; j++) {
          contentLen = (contentLen << 8) | bytes[i + 1 + j];
        }
        headerLen = 1 + numBytes;
      }
      if (contentLen < 4 || contentLen > 500) continue;
      const contentStart = i + 1 + headerLen;
      if (contentStart + contentLen > bytes.length) continue;
      const strBytes = bytes.subarray(contentStart, contentStart + contentLen);
      try {
        const str = new TextDecoder("utf-8", { fatal: true }).decode(strBytes);
        if (/[\u4e00-\u9fff]/.test(str) && str.length > bestLen) {
          bestStr = str;
          bestLen = str.length;
        }
      } catch (e) {
        /* skip */
      }
    }
    return bestStr;
  }

  function asn1LenAt(bytes, p) {
    const lb = bytes[p];
    if (lb < 0x80) return { len: lb, next: p + 1 };
    const n = lb & 0x7f;
    let len = 0;
    for (let k = 1; k <= n; k++) len = (len << 8) | bytes[p + k];
    return { len, next: p + 1 + n };
  }

  function oidDotStr(raw) {
    if (!raw || !raw.length) return "";
    const first = raw[0];
    const parts = [String(Math.floor(first / 40)), String(first % 40)];
    let val = 0;
    for (let k = 1; k < raw.length; k++) {
      val = (val << 7) | (raw[k] & 0x7f);
      if (!(raw[k] & 0x80)) {
        parts.push(String(val));
        val = 0;
      }
    }
    return parts.join(".");
  }

  // DER 字符串/时间节点 → 文本（ascii 解码，失败回退空串）
  function decodeAscii(n) {
    try {
      return new TextDecoder("ascii").decode(n.content);
    } catch (e) {
      return "";
    }
  }

  function dirStrAt(bytes, p) {
    const tag = bytes[p];
    let t = asn1LenAt(bytes, p + 1);
    const raw = bytes.subarray(t.next, t.next + t.len);
    try {
      if (tag === 0x0c) return new TextDecoder("utf-8").decode(raw);
      if (tag === 0x13) return new TextDecoder("ascii").decode(raw);
      if (tag === 0x14) return new TextDecoder("latin1").decode(raw);
      if (tag === 0x1e) return new TextDecoder("utf-16be").decode(raw);
    } catch (e) {
      console.warn("[OFD] ASN.1 目录字符串解码失败", e);
    }
    return null;
  }

  function certSubjectAttrs(cert) {
    let p = 1;
    let t = asn1LenAt(cert, p);
    if (cert[t.next] === 0x30) {
      t = asn1LenAt(cert, t.next + 1);
    }
    p = t.next;
    if ((cert[p] & 0xe0) === 0xa0) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 0x02) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 0x30 || cert[p] === 0x06) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 0x30) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] === 0x30) {
      t = asn1LenAt(cert, p + 1);
      p = t.next + t.len;
    }
    if (cert[p] !== 0x30) return null;
    t = asn1LenAt(cert, p + 1);
    const end = t.next + t.len;
    let q = t.next;
    const attrs = [];
    while (q < end) {
      if (cert[q] !== 0x31) {
        q++;
        continue;
      } // RDN ::= SET
      const s = asn1LenAt(cert, q + 1);
      let r = s.next;
      const sEnd = s.next + s.len;
      while (r < sEnd) {
        if (cert[r] === 0x30) {
          const a = asn1LenAt(cert, r + 1);
          const aEnd = a.next + a.len;
          let m = a.next;
          if (cert[m] === 0x06) {
            const o = asn1LenAt(cert, m + 1);
            const oid = oidDotStr(cert.subarray(o.next, o.next + o.len));
            const v = dirStrAt(cert, o.next + o.len);
            if (v) attrs.push({ oid, value: v });
          }
          r = aEnd;
        } else r++;
      }
      q = sEnd;
    }
    return attrs;
  }

  function collectCerts(bytes) {
    const certs = [];
    const scan = (buf) => {
      let i = 0;
      const n = buf.length;
      while (i < n - 4) {
        if (buf[i] !== 0x30) {
          i++;
          continue;
        }
        const lb = buf[i + 1];
        let len, h;
        if (lb < 0x80) {
          len = lb;
          h = 2;
        } else if (lb === 0x81) {
          len = buf[i + 2];
          h = 3;
        } else if (lb === 0x82) {
          len = (buf[i + 2] << 8) | buf[i + 3];
          h = 4;
        } else {
          i++;
          continue;
        }
        if (
          len > 200 &&
          len < 20000 &&
          i + h + len <= n &&
          buf[i + h] === 0x30
        ) {
          certs.push(buf.subarray(i, i + h + len));
          i = i + h + len;
          continue;
        }
        i++;
      }
    };
    (function walkTLV(buf) {
      let i = 0;
      const n = buf.length;
      while (i < n) {
        const tag = buf[i];
        const t = asn1LenAt(buf, i + 1);
        if (!t.len && t.next <= i + 1) {
          i++;
          continue;
        }
        const start = t.next;
        const seg = buf.subarray(start, start + t.len);
        if (tag === 0x30 || tag === 0x31 || (tag & 0xe0) === 0xa0) walkTLV(seg);
        else if (tag === 0x04) scan(seg);
        i = start + t.len;
      }
    })(bytes);
    return certs;
  }

  function extractSignerName(bytes, sealName) {
    if (!bytes || bytes.length < 20) return null;
    let certs;
    try {
      certs = collectCerts(bytes);
    } catch (e) {
      return null;
    }
    const CN_OID = "2.5.4.3",
      O_OID = "2.5.4.10";
    for (const cert of certs) {
      let attrs;
      try {
        attrs = certSubjectAttrs(cert);
      } catch (e) {
        continue;
      }
      if (!attrs || !attrs.length) continue;
      const cn = attrs.find((a) => a.oid === CN_OID);
      const o = attrs.find((a) => a.oid === O_OID);
      const s = (cn && cn.value) || (o && o.value) || "";
      if (!s) continue;
      if (
        sealName &&
        (s === sealName || s.indexOf(sealName) >= 0 || sealName.indexOf(s) >= 0)
      )
        continue;
      if (/监制章/.test(s)) continue;
      return s;
    }
    return null;
  }

  function extractSignatureValue(bytes) {
    if (!bytes || bytes.length < 70) return "";
    for (let i = 0; i < bytes.length - 69; i++) {
      if (bytes[i] !== 0x30) continue;
      const len = bytes[i + 1];
      if (len < 0x40 || len > 0x48) continue;
      if (bytes[i + 2] !== 0x02 || bytes[i + 3] !== 0x20) continue;
      if (bytes[i + 36] !== 0x02 || bytes[i + 37] !== 0x20) continue;
      const total = 2 + len;
      if (i + total > bytes.length) continue;
      let hex = "";
      for (let j = i; j < i + total; j++)
        hex += ("0" + bytes[j].toString(16)).slice(-2);
      return hex.toUpperCase();
    }
    return "";
  }

  function parseTlvTree(data) {
    let pos = 0;
    function readLen() {
      const lb = data[pos++];
      if (lb < 0x80) return lb;
      const n = lb & 0x7f;
      if (n < 1 || n > 4) return 0;
      let l = 0;
      for (let i = 0; i < n; i++) l = (l << 8) | data[pos++];
      return l;
    }
    function readNode() {
      if (pos >= data.length) return null;
      const nodeOff = pos;
      const tag = data[pos++];
      const len = readLen();
      const start = pos;
      const content = data.subarray(start, start + len);
      const node = {
        tag,
        len,
        content,
        children: [],
        parent: null,
        off: nodeOff,
        derLen: start - nodeOff + len,
      };
      const isContainer = tag === 0x30 || tag === 0x31 || (tag & 0xe0) === 0xa0;
      if (isContainer) {
        pos = start;
        const childEnd = start + len;
        while (pos < childEnd) {
          const child = readNode();
          if (!child) break;
          child.parent = node;
          node.children.push(child);
        }
        pos = childEnd;
      } else {
        pos = start + len;
      }
      return node;
    }
    return readNode();
  }

  // X.509 证书有效期：TBSCertificate 里唯一「恰好两个时间子节点」的 SEQUENCE
  function extractCertValidity(derBytes) {
    let found = null;
    (function walk(node) {
      if (!node || found) return;
      if (
        node.tag === 0x30 &&
        node.children.length === 2 &&
        node.children.every((c) => c.tag === 0x17 || c.tag === 0x18)
      ) {
        found = node.children.map(decodeAscii);
        return;
      }
      for (const c of node.children) walk(c);
    })(parseTlvTree(derBytes));
    return found ? { notBefore: found[0], notAfter: found[1] } : null;
  }

  // ASN.1 时间 / OFD 签章时间 → Unix 毫秒（UTC）
  // 兼容 UTCTime(YYMMDDHHMMSSZ)、GeneralizedTime(YYYYMMDDHHMMSSZ) 与 "2020-08-17T11:13:29"
  // GB/T 38540 SES 签名块：父 SEQUENCE 的子节点形如
  //   [待签数据 SEQUENCE, 证书 OCTET STRING, 算法 OID, 签名值 BIT STRING]
  // 返回的节点仍指向原字节（tbs.off / derLen 用于切出原始 DER，签名不可重新编码）
  function parseSesSignBlocks(data) {
    const out = [];
    (function walk(node) {
      if (!node) return;
      const ch = node.children;
      for (let k = 2; k < ch.length - 1; k++) {
        if (
          ch[k].tag === 0x06 &&
          ch[k + 1].tag === 0x03 &&
          ch[k - 1].tag === 0x04 &&
          (ch[k - 2].tag === 0x30 || ch[k - 2].tag === 0x31)
        ) {
          out.push({ tbs: ch[k - 2], cert: ch[k - 1], alg: ch[k], sig: ch[k + 1] });
        }
      }
      for (const c of ch) walk(c);
    })(parseTlvTree(data));
    return out;
  }

  // 证书 SubjectPublicKeyInfo → SM2 未压缩公钥点（130 位 hex，含 04 前缀）
  function extractCertPublicKey(derBytes) {
    const root = parseTlvTree(derBytes);
    const tbs = root && root.children[0];
    if (!tbs) return "";
    for (const c of tbs.children) {
      if (c.tag !== 0x30 || c.children.length < 2) continue;
      const algId = c.children[0];
      const bits = c.children[1];
      if (algId.tag !== 0x30 || bits.tag !== 0x03) continue;
      if (bits.len !== 66 && bits.len !== 65) continue;
      const skip = bits.len === 66 ? 1 : 0; // 66 = 1 字节 unusedBits + 65 字节点
      const pt = bits.content.subarray(skip, skip + 65);
      if (pt.length === 65 && pt[0] === 0x04) {
        let hex = "";
        for (let i = 0; i < pt.length; i++) hex += ("0" + pt[i].toString(16)).slice(-2);
        return hex;
      }
    }
    return "";
  }

  function asn1TimeToMs(str) {
    const d = String(str || "").replace(/[^0-9]/g, "");
    if (d.length < 10) return NaN;
    const short = d.length <= 12; // UTCTime 的两位年
    const yy = Number(d.slice(0, short ? 2 : 4));
    const year = short ? (yy < 50 ? 2000 + yy : 1900 + yy) : yy;
    const off = short ? 2 : 4;
    const month = Number(d.slice(off, off + 2)) - 1;
    const day = Number(d.slice(off + 2, off + 4));
    const hour = Number(d.slice(off + 4, off + 6));
    const min = Number(d.slice(off + 6, off + 8));
    const sec = Number(d.slice(off + 8, off + 10)) || 0;
    if ([month, day, hour, min].some((v) => !isFinite(v))) return NaN;
    return Date.UTC(year, month, day, hour, min, sec);
  }

  function asn1IntToStr(content) {
    if (!content || !content.length) return "";
    let hex = "";
    for (let i = 0; i < content.length; i++)
      hex += ("0" + content[i].toString(16)).slice(-2);
    return BigInt("0x" + hex).toString();
  }

  function extractSealAttrs(bytes) {
    if (!bytes || bytes.length < 10) return null;
    let root = null;
    try {
      root = parseTlvTree(bytes);
    } catch (e) {
      return null;
    }
    if (!root) return null;

    // 单次遍历：同时查找 ElectronicSeal 结构 & 收集兜底数据
    let sealInfoSeq = null,
      sealSeqRef = null;
    const fallbackInts = [],
      fallbackGtimes = [];
    let fallbackNameNode = null,
      fallbackNameLen = 0;

    function isIa5(n, val) {
      return (
        n &&
        (n.tag === 0x16 || n.tag === 0x13) &&
        n.content &&
        (() => {
          try {
            return new TextDecoder("ascii").decode(n.content) === val;
          } catch (e) {
            return false;
          }
        })()
      );
    }
    function decodeUtf8(n) {
      try {
        return new TextDecoder("utf-8").decode(n.content);
      } catch (e) {
        return "";
      }
    }

    (function walk(node) {
      if (
        sealInfoSeq &&
        fallbackInts.length &&
        fallbackGtimes.length &&
        fallbackNameNode
      )
        return;
      if (!node.children) {
        // 叶子节点：收集兜底数据
        if (node.tag === 0x02) fallbackInts.push(node);
        else if (node.tag === 0x18 || node.tag === 0x17) {
          const s = decodeAscii(node);
          if (s) fallbackGtimes.push(s);
        } else if (node.tag === 0x0c) {
          const s = decodeUtf8(node);
          if (s && /[\u4e00-\u9fff]/.test(s) && s.length > fallbackNameLen) {
            fallbackNameNode = node;
            fallbackNameLen = s.length;
          }
        }
        return;
      }
      // 容器节点：尝试匹配 ElectronicSeal Header (SEQUENCE { "ES" INTEGER ... })
      if (
        node.tag === 0x30 &&
        node.children.length >= 3 &&
        isIa5(node.children[0], "ES") &&
        node.children[1].tag === 0x02
      ) {
        const sealSeq = node.parent;
        if (sealSeq && sealSeq.tag === 0x30 && sealSeq.children.length >= 3) {
          const candidate = sealSeq.children[2];
          if (
            candidate &&
            candidate.tag === 0x30 &&
            candidate.children &&
            candidate.children.length >= 2
          ) {
            sealInfoSeq = candidate;
            sealSeqRef = sealSeq;
          }
        }
      }
      for (const c of node.children) walk(c);
      // 递归解析 OCTET_STRING（某些签名将 ElectronicSeal 嵌套在其中）
      if (
        !sealInfoSeq &&
        node.tag === 0x04 &&
        node.content &&
        node.content.length > 10
      ) {
        try {
          const t = parseTlvTree(node.content);
          if (t) walk(t);
        } catch (e) {
          console.warn("[OFD] 电子印章 OCTET_STRING 嵌套解析失败", e);
        }
      }
    })(root);

    const attrs = {};

    if (sealInfoSeq) {
      // 从 ElectronicSeal 结构精确提取
      if (sealSeqRef && sealSeqRef.children.length >= 2) {
        const idNode = sealSeqRef.children[1];
        if (idNode && (idNode.tag === 0x16 || idNode.tag === 0x13))
          attrs.id = decodeAscii(idNode);
      }
      const ic = sealInfoSeq.children;
      if (ic.length >= 2) {
        if (ic[0].tag === 0x02) attrs.type = asn1IntToStr(ic[0].content);
        if (ic[1].tag === 0x0c) attrs.name = decodeUtf8(ic[1]);
      }
      const gtimes = ic.filter((c) => c.tag === 0x18).map(decodeAscii);
      if (gtimes.length) attrs.createTime = gtimes[0];
      if (gtimes.length > 1) attrs.notBefore = gtimes[1];
      if (gtimes.length > 2) attrs.notAfter = gtimes[2];
    }

    // 兜底：从全局遍历数据中补全缺失字段
    if (!attrs.id && fallbackInts.length)
      attrs.id = asn1IntToStr(fallbackInts[0].content);
    if (!attrs.name && fallbackNameNode) {
      attrs.name = decodeUtf8(fallbackNameNode);
      if (!attrs.type) {
        const container = fallbackNameNode.parent;
        if (container) {
          const intChild = container.children.find((c) => c.tag === 0x02);
          if (intChild) attrs.type = asn1IntToStr(intChild.content);
        }
      }
    }
    if (!attrs.createTime && fallbackGtimes.length)
      attrs.createTime = fallbackGtimes[0];
    if (!attrs.notBefore && fallbackGtimes.length > 1)
      attrs.notBefore = fallbackGtimes[1];
    if (!attrs.notAfter && fallbackGtimes.length > 2)
      attrs.notAfter = fallbackGtimes[2];

    return attrs;
  }

  function oidName(oid) {
    const map = {
      "1.2.156.10197.1.401": "SM3",
      "1.2.156.10197.1.501": "SM2-SM3（签名）",
      "1.2.156.10197.1.301": "SM2（公钥）",
      "1.2.156.10197.1.302": "SM2-SM3（签名）",
      "1.2.840.113549.1.1.1": "RSA",
      "1.2.840.113549.1.1.11": "SHA256-RSA",
      "1.2.840.113549.1.1.13": "SHA512-RSA",
      "2.16.840.1.101.3.4.2.1": "SHA-256",
      "1.3.14.3.2.26": "SHA-1",
    };
    return map[oid] || oid;
  }

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

  // ==================== OFD 资源解析 ====================
  function mergeRes(target, src) {
    Object.assign(target.fonts, src.fonts);
    Object.assign(target.colorSpaces, src.colorSpaces);
    Object.assign(target.multiMedias, src.multiMedias);
    Object.assign(target.drawParams, src.drawParams);
    Object.assign(target.compositeUnits, src.compositeUnits);
  }

  async function parseRes(resPath, zip) {
    const res = {
      fonts: {},
      colorSpaces: {},
      multiMedias: {},
      drawParams: {},
      compositeUnits: {},
    };
    const xmlText = await readEntryText(zip, resPath);
    if (!xmlText) return res;
    const root = parseXml(xmlText).documentElement;
    const baseLoc = attr(root, "BaseLoc") || "";
    const baseDir = baseLoc ? resolvePath(resPath, baseLoc) : dirOf(resPath);

    const fontsEl = child(root, "Fonts");
    if (fontsEl)
      for (const f of children(fontsEl, "Font")) {
        const fontFileEl = child(f, "FontFile");
        res.fonts[attr(f, "ID")] = {
          fontName: attr(f, "FontName"),
          familyName: attr(f, "FamilyName"),
          fontFile: fontFileEl ? text(fontFileEl) : null,
          fontBaseDir: baseDir,
          _zip: zip,
        };
      }
    const csEl = child(root, "ColorSpaces");
    if (csEl)
      for (const c of children(csEl, "ColorSpace")) {
        res.colorSpaces[attr(c, "ID")] = {
          type: attr(c, "Type"),
          bits: attr(c, "BitsPerComponent"),
        };
      }
    const mmEl = child(root, "MultiMedias");
    if (mmEl)
      for (const m of children(mmEl, "MultiMedia")) {
        const mf = child(m, "MediaFile");
        res.multiMedias[attr(m, "ID")] = {
          type: attr(m, "Type"),
          format: attr(m, "Format"),
          mediaFile: mf ? text(mf) : null,
          baseDir,
          _zip: zip,
        };
      }
    const dpEl = child(root, "DrawParams");
    if (dpEl)
      for (const d of children(dpEl, "DrawParam")) {
        const dp = { id: attr(d, "ID"), lineWidth: num(d, "LineWidth", null) };
        const sc = child(d, "StrokeColor");
        if (sc) dp.strokeColor = parseColor(sc);
        const fc = child(d, "FillColor");
        if (fc) dp.fillColor = parseColor(fc);
        res.drawParams[attr(d, "ID")] = dp;
      }
    return res;
  }

  // ==================== 图像解码 ====================
  const TIFF_TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  function parseTiffTags(bytes) {
    const le = bytes[0] === 0x49 && bytes[1] === 0x49;
    const u16 = (o) =>
      le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1];
    const u32 = (o) =>
      le
        ? bytes[o] |
          (bytes[o + 1] << 8) |
          (bytes[o + 2] << 16) |
          (bytes[o + 3] << 24)
        : (bytes[o] << 24) |
          (bytes[o + 1] << 16) |
          (bytes[o + 2] << 8) |
          bytes[o + 3];
    if (bytes.length < 8 || u16(2) !== 42) return null;
    const ifd = u32(4);
    if (ifd + 2 > bytes.length) return null;
    const cnt = u16(ifd);
    const tags = {};
    for (let i = 0; i < cnt; i++) {
      const eo = ifd + 2 + i * 12;
      if (eo + 12 > bytes.length) break;
      const tag = u16(eo),
        type = u16(eo + 2),
        c = u32(eo + 4);
      const tsz = TIFF_TYPE_SIZE[type] || 1;
      const off = tsz * c <= 4 ? eo + 8 : u32(eo + 8);
      const vals = [];
      if (type === 1 || type === 7) {
        for (let j = 0; j < c && off + j < bytes.length; j++)
          vals.push(bytes[off + j]);
      } else if (type === 3) {
        for (let j = 0; j < c && off + j * 2 + 1 < bytes.length; j++)
          vals.push(u16(off + j * 2));
      } else if (type === 4) {
        for (let j = 0; j < c && off + j * 4 + 3 < bytes.length; j++)
          vals.push(u32(off + j * 4));
      }
      tags[tag] = { vals, count: c };
    }
    return tags;
  }

  function tiffLzwDecode(data) {
    const out = [];
    const dict = new Array(4096);
    let bitPos = 0,
      codeWidth = 9,
      next = 258,
      prev = null;
    for (;;) {
      if (bitPos + codeWidth > data.length * 8) break;
      let code = 0;
      for (let i = 0; i < codeWidth; i++) {
        code =
          (code << 1) |
          ((data[(bitPos + i) >> 3] >> (7 - ((bitPos + i) & 7))) & 1);
      }
      bitPos += codeWidth;
      if (code === 256) {
        next = 258;
        codeWidth = 9;
        prev = null;
        continue;
      }
      if (code === 257) break;
      let entry;
      if (code <= 255) entry = [code];
      else if (code < next) entry = dict[code];
      else if (code === next && prev) entry = prev.concat(prev[0]);
      else break;
      for (let j = 0; j < entry.length; j++) out.push(entry[j]);
      if (prev) {
        dict[next++] = prev.concat(entry[0]);
        if (codeWidth === 9 && next >= 511) codeWidth = 10;
        else if (codeWidth === 10 && next >= 1023) codeWidth = 11;
        else if (codeWidth === 11 && next >= 2047) codeWidth = 12;
      }
      prev = entry;
    }
    return out;
  }
  function tiffToBmpDataUrl(bytes) {
    const tags = parseTiffTags(bytes);
    if (!tags) return null;
    const w = tags[256] ? tags[256].vals[0] : 0;
    const h = tags[257] ? tags[257].vals[0] : 0;
    if (!w || !h) return null;
    const bps = tags[258] ? tags[258].vals : [8];
    if (bps.some((b) => b !== 8)) return null;
    const spp = tags[277] ? tags[277].vals[0] : bps.length;
    const comp = tags[259] ? tags[259].vals[0] : 1;
    if (comp !== 1 && comp !== 5) return null;
    const photo = tags[262] ? tags[262].vals[0] : 1;
    const planar = tags[284] ? tags[284].vals[0] : 1;
    if (planar !== 1) return null;
    const rowsPerStrip = tags[278] ? tags[278].vals[0] : h;
    const offsets = tags[273] ? tags[273].vals : [];
    const counts = tags[279] ? tags[279].vals : [];
    if (!offsets.length || !counts.length) return null;
    const predictor = tags[317] ? tags[317].vals[0] : 1;
    const cmap =
      photo === 3 && tags[320] && tags[320].vals.length >= 768
        ? tags[320].vals
        : null;
    const rgb = new Uint8Array(w * h * 3);
    const rowBytes = w * spp;
    for (let s = 0; s < offsets.length; s++) {
      if (offsets[s] + counts[s] > bytes.length) continue;
      const raw = bytes.subarray(offsets[s], offsets[s] + counts[s]);
      const px =
        comp === 5 ? tiffLzwDecode(raw) : Array.prototype.slice.call(raw);
      if (predictor === 2) {
        const rowsThis0 = Math.min(rowsPerStrip, h - s * rowsPerStrip);
        for (let r = 0; r < rowsThis0; r++) {
          const base = r * rowBytes;
          for (let x = 1; x < w; x++) {
            const cur = base + x * spp,
              prv = base + (x - 1) * spp;
            for (let c = 0; c < spp; c++)
              px[cur + c] = (px[cur + c] + px[prv + c]) & 0xff;
          }
        }
      }
      const rowsThis = Math.min(rowsPerStrip, h - s * rowsPerStrip);
      for (let r = 0; r < rowsThis; r++) {
        const y = s * rowsPerStrip + r;
        const srcOff = r * rowBytes,
          dstOff = y * w * 3;
        for (let x = 0; x < w; x++) {
          const p = srcOff + x * spp,
            d = dstOff + x * 3;
          let cr, cg, cb;
          if (photo === 2) {
            cr = px[p];
            cg = px[p + 1];
            cb = px[p + 2];
          } else if (cmap) {
            const idx = px[p];
            cr = cmap[idx];
            cg = cmap[256 + idx];
            cb = cmap[512 + idx];
          } else {
            const g = px[p];
            cr = cg = cb = g;
          }
          if (spp >= 4 && px[p + 3] < 255) {
            const a = px[p + 3] / 255;
            cr = cr * a + 255 * (1 - a);
            cg = cg * a + 255 * (1 - a);
            cb = cb * a + 255 * (1 - a);
          }
          rgb[d] = cr;
          rgb[d + 1] = cg;
          rgb[d + 2] = cb;
        }
      }
    }
    const rowSize = Math.floor((w * 24 + 31) / 32) * 4;
    const dataSize = rowSize * h;
    const buf = new Uint8Array(54 + dataSize);
    buf[0] = 0x42;
    buf[1] = 0x4d;
    const dv = new DataView(buf.buffer);
    dv.setUint32(2, buf.length, true);
    dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true);
    dv.setInt32(18, w, true);
    dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 24, true);
    dv.setUint32(34, dataSize, true);
    let o = 54;
    for (let y = h - 1; y >= 0; y--) {
      const srcOff = y * w * 3;
      for (let x = 0; x < w; x++) {
        buf[o++] = rgb[srcOff + x * 3 + 2];
        buf[o++] = rgb[srcOff + x * 3 + 1];
        buf[o++] = rgb[srcOff + x * 3];
      }
      o += rowSize - w * 3;
    }
    return "data:image/bmp;base64," + bytesToBase64(buf);
  }

  async function ensureImageDataUrl(mm) {
    if (!mm || !mm.mediaFile || mm.dataUrl) return mm && mm.dataUrl;
    const zip = mm._zip;
    if (!zip) return null;
    try {
      const imgPath = resolvePath(mm.baseDir + "/_.x", mm.mediaFile);
      const bytes = await readEntry(zip, imgPath);
      if (bytes) {
        const ext = (mm.mediaFile.match(/\.[^./]+$/) || [""])[0].slice(1);
        const fmt = (mm.format || ext || "").toUpperCase();
        if (fmt === "TIF" || fmt === "TIFF") {
          mm.dataUrl = tiffToBmpDataUrl(bytes);
        } else {
          const mime =
            fmt === "JPEG" || fmt === "JPG"
              ? "image/jpeg"
              : fmt === "BMP"
                ? "image/bmp"
                : fmt === "GIF"
                  ? "image/gif"
                  : "image/png";
          mm.dataUrl = "data:" + mime + ";base64," + bytesToBase64(bytes);
        }
      }
    } catch (e) {
      console.warn("[OFD] 图像资源 " + (mm.mediaFile || "") + " 解码失败", e);
    }
    return mm.dataUrl;
  }

  // ==================== OFD 页面解析 ====================
  function parseLayer(layerEl, layerDp) {
    const drawParam = attr(layerEl, "DrawParam") || layerDp;
    const objects = [];
    for (const c of layerEl.children) {
      const name = stripNs(c.tag);
      if (name === "PathObject") objects.push(parsePathObject(c, drawParam));
      else if (name === "TextObject")
        objects.push(parseTextObject(c, drawParam));
      else if (name === "ImageObject") objects.push(parseImageObject(c));
      else if (name === "CompositeObject")
        // 复合图元：只记引用，真正的图元在 DocumentRes 的 CompositeGraphicUnit 里。
        // 渲染时由 renderObject 展开（见 display/svg.js）。
        objects.push({
          type: "composite",
          resourceId: attr(c, "ResourceID"),
          ctm: parseMatrix(attr(c, "CTM")),
          boundary: parseBox(attr(c, "Boundary")),
          drawParam: attr(c, "DrawParam") || layerDp,
        });
    }
    return { drawParam, objects };
  }

  // 解析 DocumentRes 里的 <ofd:CompositeGraphicUnit>，供 CompositeObject 引用展开。
  // 数科等第三方产物把 Form XObject 的内容放在这里（实测 tracemonkey 那份 226 个 Unit，
  // 内含 226 处 Clips），引擎此前完全忽略，导致页面里 731 个图元渲染不出来。
  async function parseCompositeUnits(resPath, zip) {
    const units = {};
    const xmlText = await readEntryText(zip, resPath);
    if (!xmlText) return units;
    const root = parseXml(xmlText).documentElement;
    const list = child(root, "CompositeGraphicUnits");
    if (!list) return units;
    for (const u of children(list, "CompositeGraphicUnit")) {
      const content = child(u, "Content");
      const layers = content ? children(content, "Layer").map((l) => parseLayer(l)) : [];
      units[attr(u, "ID")] = {
        boundary: parseBox(attr(u, "Boundary")),
        layers,
      };
    }
    return units;
  }

  function parsePathObject(el, layerDp) {
    const fillEl = child(el, "FillColor");
    const strokeEl = child(el, "StrokeColor");
    const abbr = child(el, "AbbreviatedData");
    return {
      type: "path",
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      lineWidth: num(el, "LineWidth", null),
      stroke: bool(el, "Stroke", true),
      fill: bool(el, "Fill", false),
      fillColor: fillEl ? parseColor(fillEl) : null,
      strokeColor: strokeEl ? parseColor(strokeEl) : null,
      abbreviatedData: abbr ? text(abbr) : "",
      rule: attr(el, "Rule"),
      drawParam: attr(el, "DrawParam") || layerDp,
    };
  }

  // 解析 <ofd:CGTransform>/<ofd:Glyphs>：字符码位 -> 字形索引的显式映射。
  //
  // 为什么必须解析：TextCode 的文本只是「可搜索副本」，真实字形由 Glyphs 指定。
  // 子集字体里相当多的码位没有 cmap 映射（例如 tracemonkey 第 10 页刻度标签
  // 里的 `#`），浏览器按 Unicode 交给 @font-face 时查不到轮廓，
  // 会按字体回退链显示成另一个符号 —— 表现就是「图表标签多出 # 等杂符号」。
  // 拿到 Glyphs 后，引擎可以逐字定位，让缺字形的字符只影响自己。
  function parseGlyphs(el) {
    const cg = child(el, "CGTransform");
    if (!cg) return null;
    const g = child(cg, "Glyphs");
    if (!g) return null;
    const raw = (g.text || "").trim();
    if (!raw) return null;
    const gids = raw.split(/\s+/).map(Number);
    if (!gids.length || gids.some((n) => !Number.isFinite(n))) return null;
    const cp = +attr(cg, "CodePosition");
    const cc = +attr(cg, "CodeCount");
    return {
      glyphs: gids,
      codePosition: Number.isFinite(cp) ? cp : 0,
      codeCount: Number.isFinite(cc) ? cc : gids.length,
    };
  }

  function parseTextObject(el, layerDp) {
    const fillEl = child(el, "FillColor");
    const strokeEl = child(el, "StrokeColor");
    const textCodes = children(el, "TextCode").map((tc) => ({
      x: num(tc, "X", 0),
      y: num(tc, "Y", 0),
      deltaX: attr(tc, "DeltaX"),
      deltaY: attr(tc, "DeltaY"),
      // 仅剥离 XML 缩进产生的换行空白；保留行内首尾空格字形（它们按 DeltaX 占位，
      // 若误删会导致后续字符合并到窄间距重叠，见 1287页.ofd 段首缩进）
      text: (tc.text || "").replace(/^\s*\n[\s ]*/, "").replace(/[\s ]*\n\s*$/, ""),
    }));
    const glyphInfo = parseGlyphs(el);
    return {
      type: "text",
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      fontId: attr(el, "Font"),
      size: num(el, "Size", null),
      readDirection: num(el, "ReadDirection", 0),
      charDirection: num(el, "CharDirection", 0),
      hScale: num(el, "HScale", 1),
      weight: num(el, "Weight", 400),
      italic: bool(el, "Italic", false),
      stroke: bool(el, "Stroke", false),
      fill: bool(el, "Fill", true),
      fillColor: fillEl ? parseColor(fillEl) : { r: 0, g: 0, b: 0, a: 1 },
      strokeColor: strokeEl ? parseColor(strokeEl) : null,
      textCodes,
      // 逐字字形索引；为 null 表示该 TextObject 未提供 Glyphs
      glyphs: glyphInfo ? glyphInfo.glyphs : null,
      codePosition: glyphInfo ? glyphInfo.codePosition : 0,
      codeCount: glyphInfo ? glyphInfo.codeCount : 0,
      drawParam: attr(el, "DrawParam") || layerDp,
    };
  }

  function parseImageObject(el) {
    return {
      type: "image",
      boundary: parseBox(attr(el, "Boundary")),
      ctm: parseMatrix(attr(el, "CTM")),
      resourceId: attr(el, "ResourceID"),
    };
  }

  async function parsePage(pagePath, zip) {
    const xmlText = await readEntryText(zip, pagePath);
    if (!xmlText) return { pagePath, pageBox: null, templates: [], layers: [] };
    const root = parseXml(xmlText).documentElement;
    const area = child(root, "Area");
    let pageBox = null;
    if (area) {
      const box = child(area, "PhysicalBox");
      if (box) pageBox = parseBox(text(box));
    }
    const templates = children(root, "Template").map((t) => ({
      templateId: attr(t, "TemplateID"),
      zOrder: attr(t, "ZOrder") || "Background",
    }));
    const content = child(root, "Content");
    const layers = content
      ? children(content, "Layer").map((l) => parseLayer(l))
      : [];
    return { pagePath, pageBox, templates, layers };
  }

  async function parseSealOfd(sealZipBytes) {
    try {
      const sealZip = await readZip(sealZipBytes);
      // 读取 OFD.xml
      const ofdXmlText = await readEntryText(sealZip, "OFD.xml");
      if (!ofdXmlText) return null;
      const ofdRoot = parseXml(ofdXmlText).documentElement;
      const docBody = child(ofdRoot, "DocBody");
      if (!docBody) return null;
      const docEle = child(docBody, "DocRoot");
      if (!docEle) return null;
      const docPath = text(docEle);

      // 读取 Document.xml
      const docXmlText = await readEntryText(sealZip, docPath);
      if (!docXmlText) return null;
      const docRoot = parseXml(docXmlText).documentElement;

      // 解析公共资源（CommonData > PublicRes）
      let res = { fonts: {}, colorSpaces: {}, multiMedias: {}, drawParams: {} };
      const commonDataEl = child(docRoot, "CommonData");
      if (commonDataEl) {
        const publicResEl = child(commonDataEl, "PublicRes");
        if (publicResEl) {
          const publicResPath = resolvePath(docPath, text(publicResEl));
          res = await parseRes(publicResPath, sealZip);
        }
      }

      // 解析第一个页面
      const pagesEl = child(docRoot, "Pages");
      if (!pagesEl) return null;
      const pageEl = child(pagesEl, "Page");
      if (!pageEl) return null;
      const pageBaseLoc = attr(pageEl, "BaseLoc");
      if (!pageBaseLoc) return null;
      const pagePath = resolvePath(docPath, pageBaseLoc);
      const page = await parsePage(pagePath, sealZip);

      return { page, res, pagePath };
    } catch (e) {
      console.warn("parseSealOfd error:", e);
      return null;
    }
  }

  // ==================== 签名解析 ====================
  async function parseSignatures(signaturesPath, zip) {
    const stamps = [];
    const signatures = [];
    const sigsXmlText = await readEntryText(zip, signaturesPath);
    if (!sigsXmlText) return { stamps, signatures };
    const sigsRoot = parseXml(sigsXmlText).documentElement;

    for (const sig of children(sigsRoot, "Signature")) {
      const sigBaseLoc = attr(sig, "BaseLoc");
      if (!sigBaseLoc) continue;
      const sigPath = resolvePath(signaturesPath, sigBaseLoc);
      const sigXmlText = await readEntryText(zip, sigPath);
      if (!sigXmlText) continue;
      const sigRoot = parseXml(sigXmlText).documentElement;
      const signedInfo = child(sigRoot, "SignedInfo");

      let provider = "";
      let providerVersion = "";
      let signTime = "";
      let checkMethod = "";
      let signatureMethod = "";
      const references = [];
      if (signedInfo) {
        const providerEl = child(signedInfo, "Provider");
        if (providerEl) {
          provider =
            attr(providerEl, "ProviderName") ||
            text(child(providerEl, "ProviderName")) ||
            attr(providerEl, "Company") ||
            "";
          providerVersion = attr(providerEl, "Version") || "";
        }
        signatureMethod = text(child(signedInfo, "SignatureMethod")) || "";
        signTime = text(child(signedInfo, "SignatureDateTime")) || "";
        const refsEl = child(signedInfo, "References");
        if (refsEl) {
          checkMethod = attr(refsEl, "CheckMethod") || "";
          for (const ref of children(refsEl, "Reference")) {
            references.push({
              fileRef: attr(ref, "FileRef") || "",
              checkValue: text(child(ref, "CheckValue")) || "",
            });
          }
        }
      }

      let signatureDigest = "";
      const sigRaw = await readEntry(zip, sigPath);
      if (sigRaw) {
        try {
          const d = await hashBytes(sigRaw, "SM3");
          let hex = "";
          for (let i = 0; i < d.length; i++)
            hex += ("0" + d[i].toString(16)).slice(-2);
          signatureDigest = hex;
        } catch (e) {
          signatureDigest = "";
        }
      }

      let sealDataUrl = null;
      let sealOfd = null;
      const sealEl = signedInfo ? child(signedInfo, "Seal") : null;
      if (sealEl) {
        const sealBaseLoc = text(child(sealEl, "BaseLoc"));
        if (sealBaseLoc) {
          const sealPath = resolvePath(sigPath, sealBaseLoc);
          const sealBytes = await readEntry(zip, sealPath);
          if (sealBytes) {
            const pic = extractSealPicture(sealBytes);
            if (pic) {
              if (pic.type === "png") {
                sealDataUrl =
                  "data:image/png;base64," + bytesToBase64(pic.data);
              } else if (pic.type === "jpeg") {
                sealDataUrl =
                  "data:image/jpeg;base64," + bytesToBase64(pic.data);
              } else if (pic.type === "ofd") {
                sealOfd = await parseSealOfd(pic.data);
              }
            }
          }
        }
      }

      let signedValuePath = "";
      let svBytes = null;
      const signedValue = child(sigRoot, "SignedValue");
      if (signedValue) {
        signedValuePath = text(signedValue);
        if (signedValuePath)
          svBytes = await readEntry(zip, resolvePath(sigPath, signedValuePath));
      }

      if (!sealDataUrl && !sealOfd && svBytes) {
        const pic = extractSealPicture(svBytes);
        if (pic) {
          if (pic.type === "png") {
            sealDataUrl = "data:image/png;base64," + bytesToBase64(pic.data);
          } else if (pic.type === "jpeg") {
            sealDataUrl = "data:image/jpeg;base64," + bytesToBase64(pic.data);
          } else if (pic.type === "ofd") {
            sealOfd = await parseSealOfd(pic.data);
          }
        }
      }
      let sealName = null;
      let signerName = null;
      if (svBytes) {
        sealName = extractSealName(svBytes);
        signerName = extractSignerName(svBytes, sealName);
      }
      const signatureValueHex = svBytes ? extractSignatureValue(svBytes) : "";

      // 回退提取签章时间和签名方法：某些 OFD 文件将签章时间存储在 SignedValue 的
      // CMS SignerInfo 的 OCTET_STRING 中（格式 "YYYYMMDDHHMMSSZ"），
      // 签名算法以 OID 存储而非 XML SignatureMethod 元素。
      // 单次解析 + 单次遍历同时查找两者。
      if ((!signTime || !signatureMethod) && svBytes) {
        try {
          const svTree = parseTlvTree(svBytes);
          const tsRe = /^\d{14}Z$/;
          const signAlgRe =
            /^(1\.2\.156\.10197\.1\.501|1\.2\.840\.113549\.1\.1\.\d+|1\.2\.840\.10045\.4\.3)$/;
          (function find(node) {
            if ((!signTime || !signatureMethod) && node.children) {
              for (const c of node.children) find(c);
            }
            if (!signTime && (node.tag === 0x17 || node.tag === 0x18)) {
              const s = decodeAscii(node);
              if (tsRe.test(s)) signTime = s;
            }
            if (
              !signTime &&
              node.tag === 0x04 &&
              node.content &&
              node.content.length >= 14 &&
              node.content.length <= 20
            ) {
              const s = decodeAscii(node);
              if (tsRe.test(s.trim())) signTime = s.trim();
            }
            if (!signatureMethod && node.tag === 0x06) {
              const oid = oidDotStr(node.content);
              if (signAlgRe.test(oid)) signatureMethod = oid;
            }
          })(svTree);
          // 递归进入 OCTET_STRING（签名时间可能嵌套其中）
          if (!signTime || !signatureMethod) {
            (function findInOctets(node) {
              if ((!signTime || !signatureMethod) && node.children) {
                for (const c of node.children) findInOctets(c);
              }
              if (
                node.tag === 0x04 &&
                node.content &&
                node.content.length > 10
              ) {
                try {
                  const inner = parseTlvTree(node.content);
                  if (inner) find(inner);
                } catch (e) {
                  console.warn("[OFD] 签名 SignedValue 嵌套解析失败", e);
                }
              }
            })(svTree);
          }
        } catch (e) {
          /* 签名值解析失败不影响整体 */
        }
      }

      const pageRefs = [];
      const positions = [];
      if (signedInfo) {
        for (const sa of children(signedInfo, "StampAnnot")) {
          const pageRef = attr(sa, "PageRef");
          const boundary = parseBox(attr(sa, "Boundary"));
          const clip = attr(sa, "Clip") ? parseBox(attr(sa, "Clip")) : null;
          stamps.push({
            pageRef,
            boundary,
            clip,
            sealDataUrl,
            sealName,
            sealOfd,
          });
          if (pageRef && pageRefs.indexOf(pageRef) < 0) pageRefs.push(pageRef);
          if (pageRef && boundary) positions.push({ pageRef, boundary });
        }
      }

      const sealAttrs = svBytes ? extractSealAttrs(svBytes) : null;
      const certValidity = svBytes
        ? collectCerts(svBytes)
            .map(extractCertValidity)
            .filter(Boolean)
        : [];

      signatures.push({
        id: attr(sig, "ID") || "",
        signer: signerName || sealName || provider || "",
        signTime,
        provider,
        providerVersion,
        checkMethod,
        signatureMethod,
        sealDataUrl,
        sealOfd,
        pages: pageRefs,
        positions,
        references,
        signedValuePath,
        signedValueSize: svBytes ? svBytes.length : 0,
        signaturePath: "/" + sigPath,
        signatureDigest,
        signatureValueHex,
        sealAttrs,
        certValidity,
        hasSignedValue: !!(svBytes && svBytes.length),
      });
    }
    return { stamps, signatures };
  }

  // ==================== 目录解析 ====================
  function parseOutline(outlinesEl, pages) {
    if (!outlinesEl) return [];

    function collectChildItems(parent) {
      let items = children(parent, "OutlineElem");
      if (items.length) return items;
      return children(parent, "OutlineItem");
    }

    const pageMap = new Map();
    pages.forEach((p, idx) => {
      pageMap.set(String(p.id || ""), idx);
    });
    function resolvePageIndex(id) {
      if (id == null || id === "") return null;
      const s = String(id);
      if (pageMap.has(s)) return pageMap.get(s);
      const n = Number(s);
      if (isFinite(n) && n >= 1 && n <= pages.length) return Math.floor(n) - 1;
      for (const [k, v] of pageMap) {
        if (k.toLowerCase() === s.toLowerCase()) return v;
      }
      return null;
    }

    function extractDest(item) {
      let pageId =
        attr(item, "PageID") ||
        attr(item, "BookmarkPageID") ||
        attr(item, "PageRef") ||
        attr(item, "DestPage");
      let x = null,
        y = null;
      const actions = child(item, "Actions");
      if (actions) {
        for (const action of children(actions, "Action")) {
          const goto = child(action, "Goto");
          if (!goto) continue;
          const dest = child(goto, "Dest");
          if (dest) {
            const pid = attr(dest, "PageID");
            if (pid) pageId = pid;
            const dx = attr(dest, "Left");
            const dy = attr(dest, "Top");
            if (dx != null && dx !== "") x = parseFloat(dx);
            if (dy != null && dy !== "") y = parseFloat(dy);
          }
        }
      }
      return { pageId, x, y };
    }

    function extractItems(items) {
      const result = [];
      for (const item of items) {
        let title = attr(item, "Title");
        if (title == null || title === "") title = text(child(item, "Title"));
        if (!title) title = attr(item, "Name") || "(无标题)";

        const { pageId, x, y } = extractDest(item);
        const pageIndex = resolvePageIndex(pageId);

        const out = {
          title: title,
          page: pageIndex,
          dest: x != null && y != null ? { x, y } : null,
          children: [],
        };

        const subItems = collectChildItems(item);
        if (subItems.length) {
          out.children = extractItems(subItems);
        }
        result.push(out);
      }
      return result;
    }

    return extractItems(collectChildItems(outlinesEl));
  }

  function parseOutlineFromXml(xmlText, pages) {
    const root = parseXml(xmlText).documentElement;
    const outlinesEl = child(root, "Outlines");
    return parseOutline(outlinesEl || root, pages);
  }

  // ==================== 注解解析 ====================
  async function parseAnnotations(annotationsPath, zip) {
    const stamps = [];
    const annotsXmlText = await readEntryText(zip, annotationsPath);
    if (!annotsXmlText) return stamps;
    const annotsRoot = parseXml(annotsXmlText).documentElement;

    for (const pa of children(annotsRoot, "Page")) {
      const pageId = attr(pa, "PageID");
      const fileLocEl = child(pa, "FileLoc");
      const fileLoc = fileLocEl ? text(fileLocEl) : attr(pa, "FileLoc");
      if (!fileLoc) continue;
      const annotPath = resolvePath(annotationsPath, fileLoc);
      const annotXmlText = await readEntryText(zip, annotPath);
      if (!annotXmlText) continue;
      const annotRoot = parseXml(annotXmlText).documentElement;

      for (const annot of children(annotRoot, "Annot")) {
        const type = attr(annot, "Type");
        const subtype = attr(annot, "Subtype") || type;
        if (type === "Stamp") {
          if (subtype === "SignatureInFile") continue;
          const appearance = child(annot, "Appearance");
          if (appearance) {
            const boundary = parseBox(attr(appearance, "Boundary"));
            stamps.push({
              pageRef: pageId,
              boundary,
              clip: null,
              sealDataUrl: null,
              isPlaceholder: true,
            });
          }
        } else if (type === "Highlight" || type === "Path") {
          const appearance = child(annot, "Appearance");
          if (appearance) {
            const boundary = parseBox(attr(appearance, "Boundary"));
            const appearanceBlend = attr(appearance, "BlendMode") || "Normal";
            const paths = [];
            for (const po of children(appearance, "PathObject")) {
              paths.push({
                boundary: parseBox(attr(po, "Boundary")),
                stroke: bool(po, "Stroke", true),
                fill: bool(po, "Fill", false),
                fillColor: parseColor(child(po, "FillColor")),
                strokeColor: parseColor(child(po, "StrokeColor")),
                lineWidth: num(po, "LineWidth", null),
                rule: attr(po, "Rule"),
                blendMode: attr(po, "BlendMode") || appearanceBlend,
                abbr: text(child(po, "AbbreviatedData")),
              });
            }
            if (paths.length) {
              stamps.push({
                pageRef: pageId,
                boundary,
                annotType: subtype,
                paths,
                isAnnot: true,
              });
            }
          }
        }
      }
    }
    return stamps;
  }

  // ==================== OFD 文档解析 ====================
  async function parseDocument(zip) {
    mark("解析 OFD.xml", "load");
    const ofdXmlText = await readEntryText(zip, "OFD.xml");
    if (!ofdXmlText) throw new Error("OFD.xml 不存在");
    const ofdRoot = parseXml(ofdXmlText).documentElement;
    const docBody = child(ofdRoot, "DocBody");
    const docInfo = child(docBody, "DocInfo");
    const info = {
      docId: "",
      author: "",
      title: "",
      subject: "",
      creator: "",
      producer: "",
      creationDate: "",
      modDate: "",
      customDatas: {},
    };
    if (docInfo) {
      info.docId = text(child(docInfo, "DocID"));
      info.author = text(child(docInfo, "Author"));
      info.title = text(child(docInfo, "Title"));
      info.subject = text(child(docInfo, "Subject"));
      info.creator = text(child(docInfo, "Creator"));
      info.creationDate = text(child(docInfo, "CreationDate"));
      info.modDate = text(child(docInfo, "ModDate"));
      const cd = child(docInfo, "CustomDatas");
      if (cd)
        for (const c of children(cd, "CustomData")) {
          info.customDatas[attr(c, "Name") || (c.text || "").trim()] = (
            c.text || ""
          ).trim();
        }
    }
    const docRootEl = child(docBody, "DocRoot");
    const docPath = resolvePath("OFD.xml", text(docRootEl));

    const docXmlText = await readEntryText(zip, docPath);
    if (!docXmlText) throw new Error("Document.xml 不存在: " + docPath);
    const docRoot = parseXml(docXmlText).documentElement;
    mark("解析 Document.xml", "load");
    const common = child(docRoot, "CommonData");
    const pageArea = child(common, "PageArea");
    const physBox = child(pageArea, "PhysicalBox");
    const pageBox = parseBox(text(physBox));

    const templates = children(common, "TemplatePage").map((tp) => ({
      id: attr(tp, "ID"),
      baseLoc: resolvePath(docPath, attr(tp, "BaseLoc")),
      _parsed: null,
    }));
    const templateById = new Map(templates.map((t) => [t.id, t]));

    const res = {
      fonts: {},
      colorSpaces: {},
      multiMedias: {},
      drawParams: {},
      compositeUnits: {},
    };
    const publicRes = child(common, "PublicRes");
    const documentRes = child(common, "DocumentRes");
    if (publicRes)
      mergeRes(res, await parseRes(resolvePath(docPath, text(publicRes)), zip));
    if (documentRes) {
      const docResPath = resolvePath(docPath, text(documentRes));
      mergeRes(res, await parseRes(docResPath, zip));
      // CompositeGraphicUnit 里的图元要复用 page.js 的解析函数（拼接顺序在 res.js 之后），
      // 故单独解析后挂到 res 上，供渲染 CompositeObject 时展开。
      res.compositeUnits = await parseCompositeUnits(docResPath, zip);
    }
    embeddedFontMap.clear();
    fontLoadCache.clear();
    fontIndexCache = null;
    for (const id in res.fonts) {
      const f = res.fonts[id];
      if (f.fontFile && f.fontName && !embeddedFontMap.has(f.fontName)) {
        embeddedFontMap.set(f.fontName, {
          fontFile: f.fontFile,
          baseDir: f.fontBaseDir,
          _zip: f._zip,
        });
      }
    }
    mark("解析资源/预载图像", "load");

    const pagesEl = child(docRoot, "Pages");
    const pages = pagesEl
      ? children(pagesEl, "Page").map((p) => ({
          id: attr(p, "ID"),
          baseLoc: resolvePath(docPath, attr(p, "BaseLoc")),
          _parsed: null,
        }))
      : [];

    let stamps = [];
    let signatures = [];
    const signaturesEl = child(docBody, "Signatures");
    if (signaturesEl) {
      const signaturesPath = resolvePath("OFD.xml", text(signaturesEl));
      try {
        const sr = await parseSignatures(signaturesPath, zip);
        stamps.push(...sr.stamps);
        signatures.push(...sr.signatures);
      } catch (e) {
        console.warn("[OFD] 解析签名文件失败：" + signaturesPath, e);
      }
    }
    const annotationsEl = child(docRoot, "Annotations");
    if (annotationsEl) {
      const annotationsPath = resolvePath(docPath, text(annotationsEl));
      try {
        stamps.push(...(await parseAnnotations(annotationsPath, zip)));
      } catch (e) {
        console.warn("[OFD] 解析批注文件失败：" + annotationsPath, e);
      }
    }
    let outlines = [];
    const embeddedOutlinesEl = child(docRoot, "Outlines");
    if (embeddedOutlinesEl) {
      outlines = parseOutline(embeddedOutlinesEl, pages);
    } else {
      const outlinePath = resolvePath(docPath, "Document_Structure.xml");
      try {
        const outlineText = await readEntryText(zip, outlinePath);
        if (outlineText) outlines = parseOutlineFromXml(outlineText, pages);
      } catch (e) {
        console.warn("[OFD] 解析目录大纲失败：" + outlinePath, e);
      }
    }
    mark("解析签名/印章/目录", "load");

    if (_profiling) flushProfile("OFD 加载", "load");

    return {
      info,
      document: {
        docPath,
        pageBox,
        templates,
        templateById,
        pages,
        res,
        stamps,
        signatures,
        outlines,
      },
      zip,
    };
  }

  async function parseOFD(zip) {
    return parseDocument(zip);
  }

  // ==================== SVG 渲染 ====================
  const FONT_VARIANT_SUFFIX = [
    "BoldItalic",
    "Bold",
    "Italic",
    "Black",
    "Heavy",
    "ExtraBold",
    "SemiBold",
    "DemiBold",
    "Medium",
    "Regular",
    "Book",
    "Light",
  ];
  const FONT_VARIANT_RE = new RegExp(
    "^(.*?)[-\\s]+(" + FONT_VARIANT_SUFFIX.join("|") + ")$",
    "i",
  );
  const FONT_WEIGHT_MAP = {
    bold: "700",
    black: "900",
    heavy: "900",
    extrabold: "800",
    semibold: "600",
    demibold: "600",
    medium: "500",
    light: "300",
    regular: "normal",
    book: "normal",
  };
  function splitFontVariant(fontName) {
    if (!fontName) return { base: fontName, weight: "", style: "" };
    const m = fontName.match(FONT_VARIANT_RE);
    if (!m) return { base: fontName, weight: "", style: "" };
    const suf = m[2].toLowerCase();
    return {
      base: m[1],
      weight: FONT_WEIGHT_MAP[suf] || "",
      style: suf === "italic" || suf === "bolditalic" ? "italic" : "normal",
    };
  }

  function cssFontName(name) {
    return String(name).replace(/["\\]/g, "");
  }

  // 精确字体名匹配表（模块级常量，避免每次调用重建正则）
  const BUILTIN_FONT_EXACT = [
    [/dengxian|等线/, '"DengXian","等线",sans-serif'],
    [/yahei|微软雅黑/, '"Microsoft YaHei","微软雅黑",sans-serif'],
    [/pingfang|苹方/, '"PingFang SC","苹方",sans-serif'],
    [
      /source han sans|sourcehansans|noto sans|notosans|思源黑体|鸿蒙|harmonyos/,
      '"Source Han Sans SC","Noto Sans CJK SC","HarmonyOS Sans SC","思源黑体",sans-serif',
    ],
    [
      /source han serif|sourcehanserif|noto serif|notoserif|思源宋体/,
      '"Source Han Serif SC","Noto Serif CJK SC","思源宋体",serif',
    ],
  ];

  function builtinFontStack(fontName) {
    if (!fontName) return "sans-serif";
    const n = fontName.toLowerCase();
    for (let i = 0; i < BUILTIN_FONT_EXACT.length; i++) {
      if (BUILTIN_FONT_EXACT[i][0].test(n)) return BUILTIN_FONT_EXACT[i][1];
    }
    if (fontName.includes("仿") || n === "fangsong" || n.includes("fang"))
      return '"仿宋",FangSong,"STFangsong",serif';
    if (fontName.includes("宋") || n === "simsun" || n.includes("song"))
      return '"宋体",SimSun,"Songti SC",serif';
    if (fontName.includes("楷") || n === "kaiti" || n.includes("kai"))
      return '"楷体",KaiTi,"STKaiti",serif';
    if (fontName.includes("黑") || n === "simhei" || n.includes("hei"))
      return '"黑体",SimHei,"Heiti SC",sans-serif';
    if (fontName.includes("隶")) return '"隶书","LiSu",serif';
    if (fontName.includes("行")) return '"行楷","Xingkai SC",cursive';
    if (n.includes("courier")) return '"Courier New",Courier,monospace';
    if (n.includes("times")) return '"Times New Roman",serif';
    if (n.includes("arial") || n.includes("helvetica"))
      return "Arial,Helvetica,sans-serif";
    return null;
  }

  const localFontCache = new Map();
  function localFontAvailable(fontName) {
    if (
      !fontName ||
      typeof document === "undefined" ||
      !document.fonts ||
      !document.fonts.check
    )
      return false;
    if (localFontCache.has(fontName)) return localFontCache.get(fontName);
    let ok = false;
    try {
      ok = document.fonts.check('16px "' + cssFontName(fontName) + '"');
    } catch (e) {
      console.warn("[OFD] 检查本地字体可用性失败", e);
    }
    localFontCache.set(fontName, ok);
    return ok;
  }

  // 判断某个字体是否有内嵌字体文件可用（有则必须优先用内嵌的）
  //
  // fontId 传入时走精确匹配：同名不同 ID 的字体文件不同（实测 5 个 Calibri），
  // 只按名字匹配会张冠李戴。查不到再退回按名字匹配，保持对旧产物的兼容。
  //
  // 注意变体后缀：res.fonts[id].fontName 可能是 "DengXian-Regular"，
  // 而 mapFontFamily 里的 base 是 "DengXian"。registerEmbeddedFonts 两个 key 都登记，
  // 这里也两种形态都试，否则带后缀的字体会被误判为「无内嵌」而走系统字体栈。
  function hasEmbeddedFont(fontName, fontId) {
    if (!fontName || !embeddedFontMap.size) return false;
    const base = splitFontVariant(fontName).base || fontName;
    if (fontId) {
      if (embeddedFontMap.has("ofdf_" + fontId + "_" + base)) return true;
      if (embeddedFontMap.has("ofdf_" + fontId + "_" + fontName)) return true;
    }
    if (embeddedFontMap.has(base)) return true;
    if (embeddedFontMap.has(fontName)) return true;
    const lower = base.toLowerCase();
    for (const k of embeddedFontMap.keys()) {
      const kl = k.toLowerCase();
      if (kl === lower || kl.startsWith(lower + "-") || lower.startsWith(kl + "-")) return true;
    }
    return false;
  }

  // 字体 family 的选择顺序：
  //   1) **内嵌字体**（OFD 包里带FontFile 的那个）—— 与 WPS/数科 一致，必须优先
  //   2) 系统字体栈（builtinFontStack）—— 仅在无内嵌字体时兜底
  //   3) 本地同名字体 → 4) 按字体名直接引用
  //
  // 旧顺序是「系统字体优先」，导致 Helvetica 被映射到系统 Arial、
  // Calibri 被映射到系统 Calibri，内嵌字体永远加载不上 ——
  // 表现就是自家 viewer 的字形与 PDF 原稿、和 WPS 都不一致。
  // 修复前实测：数科那份 24 个字体里 Helvetica/Calibri 系列全部走系统字体。
  //
  // fontId 用于生成**唯一** family 名（见 uniqueFamily 注释）：
  // 同名不同 ID 的多个内嵌字体必须各自注册，否则只有第一个生效。
  function mapFontFamily(fontName, fontId) {
    const v = splitFontVariant(fontName);
    const base = v.base || fontName;
    const familyName = uniqueFamily(fontId, base);
    if (
      (hasEmbeddedFont(fontName, fontId) || hasEmbeddedFont(base, fontId)) &&
      embeddedLoaded.has(familyName)
    ) {
      // 内嵌字体确实已加载（@font-face 注册成功）：用唯一 family 名
      return { family: '"' + cssFontName(familyName) + '",sans-serif', weight: v.weight, style: v.style, embedded: true, key: familyName };
    }
    // 声明了内嵌但字节缺失 / 加载失败：不锁定内嵌名，继续往下走系统栈兜底
    let family = builtinFontStack(base) || builtinFontStack(fontName);
    if (!family && localFontAvailable(base))
      family = '"' + cssFontName(base) + '",sans-serif';
    if (!family) {
      ensureFontLoaded(familyName, fontId);
      family = '"' + cssFontName(familyName) + '",sans-serif';
    }
    return { family, weight: v.weight, style: v.style, embedded: false, key: familyName };
  }

  // ==================== 字体加载 ====================
  let fontBase = "";
  const FONT_EXTS = ["ttf", "otf", "woff2"];
  const fontLoadCache = new Map();
  const embeddedFontMap = new Map();
  // 真正加载成功的内嵌 family 名集合（loadFontFace 从包里读到字节并注册 @font-face 后加入）。
  // mapFontFamily 仅在此命中时才锁定内嵌唯一名；声明了内嵌但文件缺失/读取失败时，
  // 继续走系统字体栈 / 本机同名字体 / 外部目录兜底，避免文字落在一个不存在的字体名上。
  const embeddedLoaded = new Set();
  // Font ID -> 唯一的 @font-face family 名
  //
  // 为什么必须按 ID 区分：OFD 允许同一个 FontName 声明多次（不同 ID 指向不同字体文件）。
  // 实测 tracemonkey 产物里5 个不同 ID（121~125）都叫 Calibri，
  // 各自的 cmap / 字形集完全不同（Font 122 有 `#` 的真实轮廓 gid 17，
  // Font 123 则完全没有）。
  // 若只用 fontName 做 key，ensureFontLoaded('Calibri') 只会加载**第一个**，
  // 其余 4 个的 @font-face 从未注册 —— 浏览器静默回退到系统字体，
  // 字形与度量全乱（第 13 页整页乱码的真凶）。
  //
  // 解决：family 名用 `<FontID>_<FontName>` 保证唯一，
  // 同时把 cmap 也按这个唯一名缓存，hasGlyphFor 才能判准。
  function uniqueFamily(fontId, fontName) {
    return fontId ? "ofdf_" + fontId + "_" + (fontName || "unknown") : fontName;
  }

  function resolveFontBase() {
    if (fontBase) return fontBase;
    if (typeof document === "undefined") return "font/";
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src || "";
      if (/\/ofd(\.min)?\.js(\?|#|$)/.test(src)) {
        const dir = src.slice(0, src.lastIndexOf("/") + 1);
        fontBase = dir.replace(/[^/]*\/$/, "") + "font/";
        return fontBase;
      }
    }
    return "font/";
  }

  // familyName：唯一 family 名（uniqueFamily 产物）
  // fontId：Font ID，用于在 embeddedFontMap 里精确定位字体文件（同名多 ID 时必需）
  function ensureFontLoaded(familyName, fontId) {
    if (!familyName) return Promise.resolve(false);
    if (fontLoadCache.has(familyName)) return fontLoadCache.get(familyName);
    const p = loadFontFace(familyName, fontId).then(
      (ok) => {
        if (ok) embeddedLoaded.add(familyName);
        return ok;
      },
      () => false,
    );
    fontLoadCache.set(familyName, p);
    return p;
  }

  // 码位 -> 字形索引 的反向能力（判断某字符在**内嵌字体**里是否真有轮廓）。
  //
  // 为什么需要：TextObject 的 Glyphs 里，查不到字形的码位会被转换器写成 gid 1，
  // 但「gid 1」在不同子集字体里指向的东西完全不同（实测 Calibri 子集里
  // gid 1 无人引用、gid 17 其实是 `>`），单看 Glyphs 无法判断某字符该不该画。
  // 而浏览器拿不到轮廓时会走字体回退链，把整串文字的字形与度量全部打乱，
  // 表现为「乱码」。
  //
  // 正确做法：解析内嵌字体自己的 cmap，直接回答「这个码位有没有轮廓」。
  const fontCmapCache = new Map();

  function parseSfntCmap(buf) {
    const map = new Map();
    try {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      if (dv.byteLength < 12) return map;
      const numTables = dv.getUint16(4);
      let cmapOff = -1,
        cmapLen = 0;
      for (let i = 0; i < numTables; i++) {
        const o = 12 + i * 16;
        const tag = String.fromCharCode(
          dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3),
        );
        if (tag === "cmap") {
          cmapOff = dv.getUint32(o + 8);
          cmapLen = dv.getUint32(o + 12);
          break;
        }
      }
      if (cmapOff < 0 || cmapLen < 4) return map;
      const n = dv.getUint16(cmapOff + 2);
      // 优先 3,10(Unicode BMP) > 3,1(Windows BMP) > 0,x > 3,0(symbol)
      let best = -1,
        bestScore = -1;
      for (let i = 0; i < n; i++) {
        const r = cmapOff + 4 + i * 8;
        const pid = dv.getUint16(r),
          eid = dv.getUint16(r + 2);
        const off = dv.getUint32(r + 4);
        let score = 0;
        if (pid === 3 && eid === 10) score = 5;
        else if (pid === 3 && eid === 1) score = 4;
        else if (pid === 0) score = 3;
        else if (pid === 3 && eid === 0) score = 1;
        if (score > bestScore) {
          bestScore = score;
          best = cmapOff + off;
        }
      }
      if (best < 0) return map;
      const fmt = dv.getUint16(best);
      if (fmt === 4) {
        const segX2 = dv.getUint16(best + 6),
          seg = segX2 >> 1;
        const endO = best + 14,
          startO = endO + segX2 + 2;
        const deltaO = startO + segX2,
          rangeO = deltaO + segX2;
        for (let s = 0; s < seg; s++) {
          const end = dv.getUint16(endO + s * 2);
          const start = dv.getUint16(startO + s * 2);
          const delta = dv.getInt16(deltaO + s * 2);
          const ro = dv.getUint16(rangeO + s * 2);
          if (start === 0xffff) continue;
          for (let c = start; c <= end && c !== 0x10000; c++) {
            let g;
            if (ro === 0) g = (c + delta) & 0xffff;
            else {
              const gi = rangeO + s * 2 + ro + (c - start) * 2;
              if (gi + 1 >= dv.byteLength) continue;
              g = dv.getUint16(gi);
              if (g !== 0) g = (g + delta) & 0xffff;
            }
            if (g) map.set(c, g);
          }
        }
      } else if (fmt === 12) {
        const nGroups = dv.getUint32(best + 12);
        for (let i = 0; i < nGroups; i++) {
          const o = best + 16 + i * 12;
          const sc = dv.getUint32(o),
            ec = dv.getUint32(o + 4),
            sg = dv.getUint32(o + 8);
          for (let c = sc; c <= ec; c++) map.set(c, sg + (c - sc));
        }
      }
    } catch (e) {
      /* 解析失败按「无信息」处理 */
    }
    return map;
  }

  // 登记内嵌字体的 cmap（loadFontFace 拿到字节后调用）
  function cacheFontCmap(fontName, bytes) {
    if (!fontName || !bytes || fontCmapCache.has(fontName)) return;
    try {
      fontCmapCache.set(fontName, parseSfntCmap(bytes));
    } catch (e) {
      fontCmapCache.set(fontName, new Map());
    }
  }

  // 该码位在指定内嵌字体里是否真有轮廓
  function hasGlyphFor(fontName, codePoint) {
    const cm = fontCmapCache.get(fontName);
    if (!cm) return true; // 无信息 -> 不干预，保持原有行为
    if (!cm.size) return true;
    return cm.has(codePoint);
  }

  async function loadFontFace(familyName, fontId) {
    if (
      typeof FontFace === "undefined" ||
      typeof document === "undefined" ||
      !document.fonts
    )
      return false;

    // 按 Font ID 精确取。key 形态由 registerEmbeddedFonts 决定：
    //   uniqueFamily(fontId, base) 与 uniqueFamily(fontId, rawName) 两个都会登记，
    //   这里逐个试；都 miss 再退回按 family 名/字体名匹配。
    let emb = null;
    if (fontId && familyName) {
      const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
      const rawName = m ? m[1] : familyName;
      emb =
        embeddedFontMap.get(familyName) ||
        embeddedFontMap.get(rawName) ||
        null;
    }
    if (!emb && familyName) {
      // familyName 形如 ofdf_<id>_<name>，取尾部原名做匹配
      const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
      const rawName = m ? m[1] : familyName;
      emb =
        embeddedFontMap.get(familyName) ||
        embeddedFontMap.get(rawName) ||
        null;
      if (!emb) {
        const lower = rawName.toLowerCase();
        for (const [k, v] of embeddedFontMap) {
          const kl = k.toLowerCase();
          if (
            kl === lower ||
            kl.startsWith(lower + "-") ||
            lower.startsWith(kl + "-")
          ) {
            emb = v;
            break;
          }
        }
      }
    }
    if (emb && emb._zip && emb.fontFile) {
      try {
        const fontPath = resolvePath(emb.baseDir + "/_.x", emb.fontFile);
        const bytes = await readEntry(emb._zip, fontPath);
        if (bytes) {
          const face = new FontFace(familyName, bytes.buffer);
          await face.load();
          document.fonts.add(face);
          // 同步解析 cmap：供 hasGlyphFor 判断某码位在本格栅字体里是否真有轮廓
          // 按唯一 family 名缓存 —— 同名不同 ID 的字体 cmap 完全不同
          cacheFontCmap(familyName, bytes);
          return true;
        }
      } catch (e) {
        console.warn("[OFD] 加载内嵌字体失败：" + familyName, e);
      }
    }

    const index = await fetchFontIndex();
    let loaded = false;
    if (index) {
      // 外部字体目录按**原始字体名**索引，不带 ID 前缀
      const rawName = /^ofdf_[^_]+_(.+)$/.exec(familyName);
      const lookupName = rawName ? rawName[1] : familyName;
      for (const ext of FONT_EXTS) {
        const file = lookupName + "." + ext;
        if (index.indexOf(file) === -1) continue;
        const url =
          resolveFontBase() + encodeURIComponent(lookupName) + "." + ext;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const ab = await res.arrayBuffer();
          const face = new FontFace(familyName, ab);
          await face.load();
          document.fonts.add(face);
          cacheFontCmap(familyName, new Uint8Array(ab));
          loaded = true;
          break;
        } catch (e) {
          console.warn("[OFD] 加载字体文件失败：" + url, e);
        }
      }
    }
    if (!loaded) {
      // 有内置映射或本机同名字体可兜底时，mapFontFamily 会用系统字体渲染（非默认字体），不再告警
      const m = /^ofdf_[^_]+_(.+)$/.exec(familyName);
      const base = m ? m[1] : familyName;
      if (!(builtinFontStack(base) || builtinFontStack(familyName) || localFontAvailable(base))) {
        console.warn('[OFD] 未找到字体 "' + familyName + '"，且无系统映射，回退 sans-serif');
      }
    }
    return loaded;
  }

  let fontIndexCache = null;
  function fetchFontIndex() {
    if (fontIndexCache) return fontIndexCache;
    fontIndexCache = fetch(resolveFontBase())
      .then((res) => {
        if (!res.ok) return null;
        return res.text();
      })
      .then((html) => {
        if (!html) return null;
        const names = [];
        const re = /href="([^"]+)"/g;
        let m;
        while ((m = re.exec(html)))
          names.push(decodeURIComponent(m[1].split(/[?#]/)[0]));
        return names;
      })
      .catch(() => null);
    return fontIndexCache;
  }

  // ==================== 内嵌字体登记 ====================
  // 把 OFD 资源里声明了 <ofd:FontFile> 的字体登记进 embeddedFontMap。
  //
  // 为什么必须有这一步：embeddedFontMap 原本只读不写，导致：
  //   1) hasEmbeddedFont() 恒返回 false  -> mapFontFamily 永远走 builtinFontStack
  //   2) loadFontFace() 找不到 emb       -> 只能退回 font/ 目录
  // 而 font/ 目录不存在，于是全部字体落sans-serif（Windows 上解析为黑体）——
  // 这就是「所有字体都显示为黑体」的直接原因。
  //
  // 参照 ensureImageDataUrl(mm) 的做法：res.fonts[id] 本身就带
  // fontFile / fontBaseDir / _zip，直接登记即可，无需额外 I/O。
  //
  // **登记的 key 必须与 mapFontFamily 生成的 family 名严格一致**，否则
  // loadFontFace 按familyName 反查会miss。这里有两条命名路径：
  //   mapFontFamily → uniqueFamily(fontId, v.base || fontName)
  //   v.base 是 splitFontVariant 剥掉 -Regular/-Bold 等后缀后的**基名**
  // 所以必须用同一个 base 拼 key。实测踩过的坑：
  //   res.fonts[1289].fontName = "DengXian-Regular"
  //   若按原名登记 → key "ofdf_1289_DengXian-Regular"
  //   但 mapFontFamily 产出的是 "ofdf_1289_DengXian"（base）
  //   查找 miss → 退回 font/ 目录 → 加载失败 → sans-serif → 黑体
  function registerEmbeddedFonts(fonts) {
    if (!fonts) return;
    for (const key in fonts) {
      const f = fonts[key];
      if (!f || !f.fontFile || !f._zip) continue;
      const name = f.fontName || f.familyName;
      if (!name) continue;
      const entry = {
        fontFile: f.fontFile,
        baseDir: f.fontBaseDir || "",
        _zip: f._zip,
      };
      // 基名（与 mapFontFamily 的 uniqueFamily 参数一致）—— 主路径，必须命中
      const base = splitFontVariant(name).base || name;
      const uniqBase = uniqueFamily(key, base);
      if (!embeddedFontMap.has(uniqBase)) embeddedFontMap.set(uniqBase, entry);
      // 原名（含变体后缀）—— mapFontFamily 未剥后缀时用得到
      const uniqRaw = uniqueFamily(key, name);
      if (!embeddedFontMap.has(uniqRaw)) embeddedFontMap.set(uniqRaw, entry);
      // 裸名条目，兼容按字体名查找的旧路径
      if (!embeddedFontMap.has(base)) embeddedFontMap.set(base, entry);
      if (!embeddedFontMap.has(name)) embeddedFontMap.set(name, entry);
    }
  }

  function setFontBase(base) {
    fontBase = base || "";
  }

  function getEmbeddedFontNames() {
    return Array.from(embeddedFontMap.keys());
  }

  // ==================== SVG 元素渲染 ====================
  // 把解析后的页面图元（路径 / 文字 / 图像 / 印章 / 注解）转成 SVG 片段。
  const ABBR_PATH_CACHE_MAX = 4096;
  const abbrPathCache = new LRUCache(ABBR_PATH_CACHE_MAX);
  function abbreviatedToSvgPath(abbr) {
    if (!abbr) return "";
    if (abbrPathCache.has(abbr)) return abbrPathCache.get(abbr);
    const tokens = abbr.trim().split(/\s+/);
    const numRe = /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/;
    let d = "";
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (!t) {
        i++;
        continue;
      }
      const cmd = t[0];
      if (cmd === "C" && t.length === 1) {
        d += "Z ";
        i++;
        continue;
      }
      if ("MLQBAS".indexOf(cmd) >= 0) {
        const svgCmd = cmd === "B" ? "C" : cmd === "S" ? "M" : cmd;
        d += svgCmd;
        i++;
        while (i < tokens.length && numRe.test(tokens[i])) {
          d += " " + tokens[i];
          i++;
        }
        d += " ";
      } else if (numRe.test(t)) {
        i++;
      } else {
        i++;
      }
    }
    d = d.trim();
    abbrPathCache.set(abbr, d);
    return d;
  }

  function renderPathObject(obj, res) {
    const d = abbreviatedToSvgPath(obj.abbreviatedData);
    if (!d) return "";
    const b = obj.boundary;
    const bx = b.x,
      by = b.y;
    let transform = `translate(${bx} ${by})`;
    if (obj.ctm) transform += ` matrix(${obj.ctm.join(" ")})`;
    const dp = obj.drawParam ? res.drawParams[obj.drawParam] : null;
    const lineWidth =
      obj.lineWidth != null
        ? obj.lineWidth
        : dp && dp.lineWidth != null
          ? dp.lineWidth
          : 0.7;
    const strokeColor = obj.strokeColor || (dp && dp.strokeColor) || null;
    const fillColor = obj.fillColor || (dp && dp.fillColor) || null;
    let attrs = `fill="none"`;
    if (obj.fill && fillColor) attrs = `fill="${colorToCss(fillColor)}"`;
    if (obj.rule === "Even-Odd") attrs += ' fill-rule="evenodd"';
    if (obj.stroke) {
      attrs += ` stroke="${colorToCss(strokeColor || fillColor || { r: 0, g: 0, b: 0, a: 1 })}" stroke-width="${lineWidth}"`;
    }
    return `<g transform="${transform}"><path d="${d}" ${attrs}/></g>`;
  }

  function renderTextObject(obj, res) {
    const font = res.fonts[obj.fontId] || {};
    const fv = mapFontFamily(font.fontName, obj.fontId);
    const hScale = obj.hScale != null ? obj.hScale : 1;
    const ctm = obj.ctm;
    const bx = obj.boundary.x,
      by = obj.boundary.y;
    const fill = obj.fill ? colorToCss(obj.fillColor) : "none";
    const weight = fv.weight || (obj.weight >= 700 ? "bold" : "normal");
    const fontStyle = fv.style || (obj.italic ? "italic" : "normal");

    // 渲染单个 TextCode 的 tspan 片段。
    //
    // 「无轮廓字符」的判定：**cmap 与 Glyphs 双重确认**，缺一不可。
    //
    // 为什么不能只看 cmap：子集字体里大量字符用**私有区假码**（U+E000–U+E0FF）。
    // 实测 Calibri-Bold 子集：n/k/h/c/o/A 这些正文常用字母的 cmap 里全都没有，
    // 只有等量的私有区条目。只看 cmap 会把第 6 页的 Anchor / Branch / AnchorTable
    // 整片误杀（实测 117 处）。
    //
    // 为什么不能只看 Glyphs：转换器对查不到字形的码位写 gid 1，
    // 但 gid 1 在不同子集字体里指向的东西完全不同（实测 Calibri 子集
    // gid 1 无人引用、gid 17 其实是 `>`），
    // 「gid===1 就跳过」会漏判 —— 第 11 页的 `#` 拿到 gid 17 就被画了出来。
    //
    // 正确判据（两者都指向「无轮廓」才跳过）：
    //   1. cmap 里查不到该码位（hasGlyphFor 为false），**且**
    //   2. Glyphs 对应位置是占位 gid（gid === 1），或没有 Glyphs 信息
    // 这样：私有区假码的正文靠 Glyphs 的非占位 gid 保留；
    //真正无轮廓的 `#` 因 cmap 查不到且 gid 为占位而被剔除。
    //
    // 跳过后**保留 DeltaX 占位**，后续字符绝对坐标不受影响，
    // 与 WPS/Acrobat 打开原 PDF 的表现一致（原 PDF 那格也是空白）。
    function buildTextCodeParts(tc, ox0, oy0, hScale, readDirection, fontName, glyphs) {
      const txt = tc.text;
      if (!txt) return "";
      const dxArr = expandDelta(tc.deltaX);
      const dyArr = expandDelta(tc.deltaY);
      // 预先算出每个字符是否可绘制
      const draw = [];
      let anySkip = false;
      for (let i = 0; i < txt.length; i++) {
        const cp = txt.codePointAt(i);
        let ok = true;
        if (!hasGlyphFor(fontName, cp)) {
          // cmap 无此码位 —— 再看 Glyphs 是否为占位
          const gid = glyphs ? glyphs[i] : undefined;
          const isPlaceholder = gid === undefined || gid === 1;
          ok = !isPlaceholder; // 有真字形（私有区假码）-> 仍要画
        }
        draw.push(ok);
        if (!ok) anySkip = true;
      }
      let ox = ox0,
        oy = oy0;
      if (readDirection === 90 || readDirection === 270) {
        const ang = readDirection;
        let s = "";
        for (let i = 0; i < txt.length; i++) {
          const adjX = hScale !== 1 ? ox / hScale : ox;
          if (draw[i])
            s += `<tspan x="${adjX.toFixed(4)}" y="${oy.toFixed(4)}" transform="rotate(${ang} ${adjX.toFixed(4)} ${oy.toFixed(4)})">${escapeXml(txt[i])}</tspan>`;
          ox += i < dxArr.length ? dxArr[i] : 0;
          oy += i < dyArr.length ? dyArr[i] : 0;
        }
        return s;
      }
      // 常规方向：可合并为一个 tspan；但若需要跳过部分字符，则逐字符输出，
      // 跳过字符用空 tspan 占位（保留坐标推进，不绘制任何东西）。
      if (!anySkip) {
        let xs = "",
          ys = "";
        for (let i = 0; i < txt.length; i++) {
          const adjX = hScale !== 1 ? ox / hScale : ox;
          xs += (i ? " " : "") + adjX.toFixed(4);
          ys += (i ? " " : "") + oy.toFixed(4);
          ox += i < dxArr.length ? dxArr[i] : 0;
          oy += i < dyArr.length ? dyArr[i] : 0;
        }
        return `<tspan x="${xs}" y="${ys}">${escapeXml(txt)}</tspan>`;
      }

      let s = "";
      for (let i = 0; i < txt.length; i++) {
        const adjX = hScale !== 1 ? ox / hScale : ox;
        // 无轮廓字符 -> 输出空 tspan 只推进坐标，不绘制
        const body = draw[i] ? escapeXml(txt[i]) : "";
        s += `<tspan x="${adjX.toFixed(4)}" y="${oy.toFixed(4)}">${body}</tspan>`;
        ox += i < dxArr.length ? dxArr[i] : 0;
        oy += i < dyArr.length ? dyArr[i] : 0;
      }
      return s;
    }

    // CTM 分支：使用 SVG matrix 变换（含旋转），文字坐标为局部坐标
    // OFD CTM = [a, b, c, d, e, f]，变换：x' = a*x + c*y + e, y' = b*x + d*y + f
    // SVG matrix(a, b, c, d, e, f) 同理
    if (ctm) {
      const fontSize = obj.size != null ? obj.size : 3;
      const parts = [];
      for (const tc of obj.textCodes) {
        parts.push(buildTextCodeParts(tc, tc.x, tc.y, 1, 0, fv.key || font.fontName, obj.glyphs));
      }
      const transform = `translate(${bx} ${by}) matrix(${ctm[0]} ${ctm[1]} ${ctm[2]} ${ctm[3]} ${ctm[4]} ${ctm[5]})`;
      return `<text font-family="${escapeXml(fv.family)}" font-size="${fontSize}" font-weight="${weight}" font-style="${fontStyle}" fill="${fill}" transform="${transform}" xml:space="preserve" text-rendering="geometricPrecision">${parts.join("")}</text>`;
    }

    // 无 CTM：简单定位
    const fontSize = obj.size != null ? obj.size : 3;
    const parts = [];
    for (const tc of obj.textCodes) {
      parts.push(
        buildTextCodeParts(tc, bx + tc.x, by + tc.y, hScale, obj.readDirection, fv.key || font.fontName, obj.glyphs),
      );
    }
    let transform = "";
    if (hScale !== 1) transform = ` transform="scale(${hScale} 1)"`;
    return `<text font-family="${escapeXml(fv.family)}" font-size="${fontSize}" font-weight="${weight}" font-style="${fontStyle}" fill="${fill}"${transform} xml:space="preserve" text-rendering="geometricPrecision">${parts.join("")}</text>`;
  }

  async function renderImageObject(obj, res) {
    const mm = res.multiMedias[obj.resourceId];
    if (!mm) return "";
    if (!mm.dataUrl) await ensureImageDataUrl(mm); // 渲染到该页时才懒加载图像
    if (!mm.dataUrl) return "";
    const b = obj.boundary;
    let x, y, w, h;
    if (obj.ctm) {
      const a = obj.ctm;
      // CTM 将单位图像 (0..1) 映射到 boundary 局部坐标（Y 向下）
      w = a[0];
      h = a[3];
      x = b.x + a[4];
      y = b.y + a[5];
    } else {
      x = b.x;
      y = b.y;
      w = b.w;
      h = b.h;
    }
    return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(mm.dataUrl)}" preserveAspectRatio="none"/>`;
  }

  async function renderObject(obj, res) {
    switch (obj.type) {
      case "path":
        return renderPathObject(obj, res);
      case "text":
        return renderTextObject(obj, res);
      case "image":
        return await renderImageObject(obj, res);
      case "composite":
        return renderCompositeObject(obj, res);
    }
    return "";
  }

  // 展开 <ofd:CompositeObject>：把 DocumentRes 里对应 CompositeGraphicUnit 的
  // 内部图元套上「Unit 边界 → 页面 CTM/Boundary」的组合变换后渲染。
  //
  // OFD 渲染语义与 PathObject 一致：图元实际位置 = Boundary原点 + CTM·(内部路径点)，
  // Unit 内部的图元用 Unit 自己的 Boundary 作为局部原点，因此合成矩阵为
  //   页面变换 = translate(obj.boundary) · obj.ctm · translate(-unit.boundary)
  function renderCompositeObject(obj, res) {
    const unit = res.compositeUnits && res.compositeUnits[obj.resourceId];
    if (!unit || !unit.layers) return "";
    const b = obj.boundary;
    const ub = unit.boundary;
    const m = obj.ctm;
    // 组装：先移到页面 Boundary，再按 CTM 变换，最后抵消 Unit 的局部原点
    let tf = `translate(${b.x} ${b.y})`;
    if (m) tf += ` matrix(${m.join(" ")})`;
    if (ub && (ub.x !== 0 || ub.y !== 0)) tf += ` translate(${-ub.x} ${-ub.y})`;
    const inner = unit.layers
      .map((layer) => (layer.objects || []).map((o) => renderObject(o, res)).join(""))
      .join("");
    if (!inner) return "";
    return `<g transform="${tf}">${inner}</g>`;
  }

  async function getTemplateLayers(tpl, ofd) {
    if (!tpl._parsed) tpl._parsed = await parsePage(tpl.baseLoc, ofd.zip);
    return tpl._parsed.layers;
  }

  async function ensurePageParsed(ofd, pageIndex) {
    const doc = ofd.document;
    const p = doc.pages[pageIndex];
    if (!p) throw new Error("页码越界: " + pageIndex);
    if (!p._parsed) p._parsed = await parsePage(p.baseLoc, ofd.zip);
    return p._parsed;
  }

  // 渲染印章（StampAnnot）
  // Boundary 定义印章在页面上的位置和大小（OFD 坐标，Y 向下）
  // Clip 定义可见区域（Boundary 局部坐标，Y 向下）；骑缝章时 Clip 只占完整印章的一部分
  // 页面印章（签章）渲染透明度，1 为完全不透明。文本下方的印章需半透明以便透出字迹。
  const SEAL_OPACITY = 0.8;

  async function renderStamp(stamp, stampIdx) {
    const b = stamp.boundary;
    const x = b.x,
      y = b.y,
      w = b.w,
      h = b.h;
    // 标记：供前端点击事件定位到对应印章（data-stamp-idx 为「当前页内」印章序号）
    const dataAttr = ' data-stamp-idx="' + stampIdx + '"';

    // 1. OFD 矢量印章：递归渲染印章的 OFD 内容
    if (stamp.sealOfd) {
      const sealPage = stamp.sealOfd.page;
      const sealRes = stamp.sealOfd.res;
      const sealPageBox = sealPage.pageBox || { w: w, h: h };
      const sealW = sealPageBox.w;
      const sealH = sealPageBox.h;

      // 分离路径和文字：先画路径（椭圆环），再画文字（避免椭圆线遮挡文字）
      const pathParts = [],
        textParts = [];
      for (const layer of sealPage.layers) {
        for (const obj of layer.objects) {
          if (obj.type === "text") {
            textParts.push(await renderObject(obj, sealRes));
          } else {
            pathParts.push(await renderObject(obj, sealRes));
          }
        }
      }
      const sealSvg = pathParts.join("") + textParts.join("");

      // 缩放比例：印章 OFD 坐标系 → 页面坐标系
      const scaleX = w / sealW;
      const scaleY = h / sealH;

      const clip = stamp.clip;
      if (
        clip &&
        clip.w > 0 &&
        clip.h > 0 &&
        (clip.x > 0 || clip.y > 0 || clip.w < w || clip.h < h)
      ) {
        // 骑缝章裁剪
        const clipId = "stampClip_" + stampIdx;
        const clipSvgX = x + clip.x;
        const clipSvgY = y + clip.y;
        return (
          `<clipPath id="${clipId}"><rect x="${clipSvgX}" y="${clipSvgY}" width="${clip.w}" height="${clip.h}"/></clipPath>` +
          `<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" clip-path="url(#${clipId})" opacity="${SEAL_OPACITY}"${dataAttr}>${sealSvg}</g>`
        );
      }

      return `<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" opacity="${SEAL_OPACITY}"${dataAttr}>${sealSvg}</g>`;
    }

    // 2. PNG 位图印章
    if (stamp.sealDataUrl) {
      const clip = stamp.clip;
      if (
        clip &&
        clip.w > 0 &&
        clip.h > 0 &&
        (clip.x > 0 || clip.y > 0 || clip.w < w || clip.h < h)
      ) {
        const clipId = "stampClip_" + stampIdx;
        const clipSvgX = x + clip.x;
        const clipSvgY = y + clip.y;
        return (
          `<clipPath id="${clipId}"><rect x="${clipSvgX}" y="${clipSvgY}" width="${clip.w}" height="${clip.h}"/></clipPath>` +
          `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(stamp.sealDataUrl)}" preserveAspectRatio="none" clip-path="url(#${clipId})" opacity="${SEAL_OPACITY}"${dataAttr}/>`
        );
      }
      return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeXml(stamp.sealDataUrl)}" preserveAspectRatio="none" opacity="${SEAL_OPACITY}"${dataAttr}/>`;
    }

    // 3. 无印章图片也无 OFD 矢量：渲染占位符
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const strokeWidth = Math.max(0.4, Math.min(rx, ry) * 0.06);
    return (
      `<g opacity="${SEAL_OPACITY}"${dataAttr}>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="red" stroke-width="${strokeWidth}" stroke-dasharray="2 1"/>` +
      `</g>`
    );
  }

  function renderAnnot(annot) {
    const b = annot.boundary;
    const parts = [];
    for (const p of annot.paths) {
      const d = abbreviatedToSvgPath(p.abbr);
      if (!d) continue;
      const tx = b.x + p.boundary.x;
      const ty = b.y + p.boundary.y;
      let attrs = 'fill="none"';
      if (p.fill && p.fillColor) attrs = `fill="${colorToCss(p.fillColor)}"`;
      if (p.stroke) {
        const sw = p.lineWidth != null ? p.lineWidth : 0.7;
        attrs += ` stroke="${colorToCss(p.strokeColor || p.fillColor || { r: 0, g: 0, b: 0, a: 1 })}" stroke-width="${sw}"`;
      }
      if (p.rule === "Even-Odd") attrs += ' fill-rule="evenodd"';
      const blend = (p.blendMode || "Normal").toLowerCase();
      const style =
        blend === "normal" ? "" : ` style="mix-blend-mode:${blend}"`;
      parts.push(
        `<path d="${d}" ${attrs} transform="translate(${tx} ${ty})"${style}/>`,
      );
    }
    return parts.join("");
  }

  async function sealToSvgString(sealOfd, widthPx) {
    const page = sealOfd.page;
    const res = sealOfd.res;
    const box = page.pageBox || { w: 1, h: 1 };
    let body = "";
    for (const layer of page.layers) {
      for (const obj of layer.objects) body += await renderObject(obj, res);
    }
    const w = widthPx || 100;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${w}" preserveAspectRatio="xMidYMid meet" style="display:block">${body}</svg>`;
  }

  // ==================== SVG 缓存 ====================
  const SVG_CACHE_MAX = 256;
  function svgCacheKey(pageIndex, opts) {
    return pageIndex + "|" + (opts && opts.width ? opts.width : "");
  }
  async function renderPageToString(ofd, pageIndex, opts) {
    opts = opts || {};
    if (!ofd._svgCache) ofd._svgCache = new LRUCache(SVG_CACHE_MAX);
    const cacheKey = svgCacheKey(pageIndex, opts);
    const cached = ofd._svgCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const doc = ofd.document;
    const pgTag = _profiling ? "page-" + pageIndex : "";
    if (_profiling)
      mark("页面 " + (pageIndex + 1) + "：解析页面 XML", pgTag);
    const page = await ensurePageParsed(ofd, pageIndex);
    const pageBox = page.pageBox || doc.pageBox;
    const pageW = pageBox.w,
      pageH = pageBox.h;

    const layers = [];
    for (const t of page.templates) {
      if (t.zOrder !== "Foreground") {
        const tpl = doc.templateById.get(t.templateId);
        if (tpl) layers.push(...(await getTemplateLayers(tpl, ofd)));
      }
    }
    layers.push(...page.layers);
    for (const t of page.templates) {
      if (t.zOrder === "Foreground") {
        const tpl = doc.templateById.get(t.templateId);
        if (tpl) layers.push(...(await getTemplateLayers(tpl, ofd)));
      }
    }
    if (_profiling)
      mark("页面 " + (pageIndex + 1) + "：加载模板/图层", pgTag);

    // 必须**先**登记内嵌字体，再收集字体名 ——
    // hasEmbeddedFont() 依赖 embeddedFontMap，顺序颠倒会导致全部字体被判为「无内嵌」
    // 而退回系统字体栈（build/font/ 是空目录），字形与 PDF 原稿、WPS 都不一致。
    registerEmbeddedFonts(doc.res.fonts);

    const imgIds = new Set();
    // 收集 **Font ID**（而不是字体名）：同名不同 ID 的内嵌字体必须各自预取，
    // 否则只有第一个注册成功，其余静默回退系统字体（第 13 页整页乱码的真凶）。
    const fontIds = new Set();
    for (const layer of layers) {
      for (const obj of layer.objects) {
        if (obj.type === "image") imgIds.add(obj.resourceId);
        if (obj.type === "text" && obj.fontId != null) fontIds.add(obj.fontId);
      }
    }

    const prefetchTasks = [];
    for (const id of imgIds) {
      const mm = doc.res.multiMedias[id];
      if (mm && !mm.dataUrl) prefetchTasks.push(ensureImageDataUrl(mm));
    }
    // 字体预取：与 mapFontFamily 的优先级保持一致 ——
    // **只要有内嵌字体就必须加载**（内嵌优先于系统字体栈），
    // 否则 Helvetica/Calibri 这类命中 builtinFontStack 的名字会被跳过预取，
    // SVG 用系统字体渲染，字形与 PDF 原稿、WPS 都不一致。
    let needFontIndex = false;
    for (const fid of fontIds) {
      const f = doc.res.fonts[fid];
      const name = f && f.fontName;
      if (!name) continue;
      const v = splitFontVariant(name);
      const family = uniqueFamily(fid, v.base || name);
      if (hasEmbeddedFont(name, fid) || hasEmbeddedFont(v.base, fid)) {
        prefetchTasks.push(ensureFontLoaded(family, fid));
        continue;
      }
      if (
        !builtinFontStack(v.base) &&
        !builtinFontStack(name) &&
        !localFontAvailable(v.base)
      ) {
        needFontIndex = true;
        prefetchTasks.push(ensureFontLoaded(family, fid));
      }
    }
    if (needFontIndex) prefetchTasks.push(fetchFontIndex());
    if (prefetchTasks.length) await Promise.allSettled(prefetchTasks);
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：预取", pgTag);

    const bodyParts = [
      `<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff"/>`,
    ];
    for (const layer of layers) {
      for (const obj of layer.objects)
        bodyParts.push(await renderObject(obj, doc.res));
    }
    const pageId = doc.pages[pageIndex] ? doc.pages[pageIndex].id : null;
    if (doc.stamps && pageId) {
      let stampIdx = 0;
      for (const stamp of doc.stamps) {
        if (stamp.pageRef === pageId) {
          if (stamp.isAnnot) {
            bodyParts.push(renderAnnot(stamp));
          } else {
            bodyParts.push(await renderStamp(stamp, stampIdx++));
          }
        }
      }
    }
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：SVG 构建", pgTag);
    const widthAttr = opts.width ? ` width="${opts.width}"` : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageW} ${pageH}"${widthAttr} preserveAspectRatio="xMidYMin meet" class="ofd-page-svg">${bodyParts.join("")}</svg>`;
    ofd._svgCache.set(cacheKey, svg);
    if (_profiling) mark("页面 " + (pageIndex + 1) + "：渲染完成", pgTag);
    if (_profiling) flushProfile("渲染 第 " + (pageIndex + 1) + " 页", pgTag);
    return svg;
  }

  function svgStringToElement(svgString) {
    if (typeof document === "undefined") return svgString;
    const container = document.createElement("div");
    container.innerHTML = svgString;
    return container.firstElementChild;
  }

  async function load(source) {
    mark("读取文件数据", "load");
    let data;
    if (typeof source === "string") {
      if (/^(javascript|file|data):/i.test(source))
        throw new Error("不安全的 URL 协议");
      const res = await fetch(source);
      if (!res.ok)
        throw new Error("加载 OFD 失败: " + res.status + " " + res.statusText);
      data = new Uint8Array(await res.arrayBuffer());
    } else if (typeof Blob !== "undefined" && source instanceof Blob) {
      data = new Uint8Array(await source.arrayBuffer());
    } else if (source instanceof ArrayBuffer) {
      data = new Uint8Array(source);
    } else if (source instanceof Uint8Array) {
      data = source;
    } else if (source && source.byteLength !== undefined) {
      data = new Uint8Array(source.buffer ? source.buffer : source);
    } else {
      throw new Error("不支持的 source 类型");
    }
    const zip = await readZip(data);
    mark("ZIP 解压", "load");
    return await parseOFD(zip);
  }

  async function renderPage(ofd, pageIndex, opts) {
    return svgStringToElement(await renderPageToString(ofd, pageIndex, opts));
  }

  async function renderAll(ofd, opts) {
    const count = ofd.document.pages.length;
    const els = [];
    for (let i = 0; i < count; i++) els.push(await renderPage(ofd, i, opts));
    return els;
  }

  function getPageCount(ofd) {
    return ofd.document.pages.length;
  }

  async function getPageDimensions(ofd, pageIndex) {
    if (pageIndex == null) pageIndex = 0;
    const page = await ensurePageParsed(ofd, pageIndex);
    const box = page.pageBox || ofd.document.pageBox;
    return { width: box.w, height: box.h, unit: "mm" };
  }

  function getDocumentInfo(ofd) {
    return Object.assign({ pageCount: ofd.document.pages.length }, ofd.info);
  }

  // ==================== 签名 API ====================
  function formatSignTime(t) {
    if (!t) return "";
    const s = String(t).trim();
    let m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z?$/);
    if (m)
      return (
        m[1] + "-" + m[2] + "-" + m[3] + " " + m[4] + ":" + m[5] + ":" + m[6]
      );
    m = s.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
    if (m) return s.replace("T", " ");
    return s;
  }

  // ASN.1 时间（UTCTime 12 位 / GeneralizedTime 14 位）→ "YYYY-MM-DD HH:MM:SS"（UTC）
  function formatAsn1Time(s) {
    const ms = asn1TimeToMs(s);
    if (!isFinite(ms)) return s || "";
    const d = new Date(ms);
    const p = (v) => (v < 10 ? "0" + v : "" + v);
    return (
      d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()) +
      " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds())
    );
  }

  async function getSignatures(ofd) {
    const doc = ofd.document;
    const sigs = doc.signatures || [];
    // 页 id → 索引：把下面每个 pageRef 的 O(N) findIndex 降为 O(1)。
    // 用原始 id 作 key（保留 === 语义），重复 id 取首次出现。
    const pageIndex = new Map();
    for (let i = 0; i < doc.pages.length; i++) {
      const id = doc.pages[i].id;
      if (!pageIndex.has(id)) pageIndex.set(id, i);
    }
    return Promise.all(
      sigs.map(async (s, i) => {
        const pageNums = [];
        for (const ref of s.pages) {
          const idx = pageIndex.get(ref);
          if (idx !== undefined) pageNums.push(idx + 1);
        }
        const positions = (s.positions || [])
          .map((pos) => {
            const idx = pageIndex.get(pos.pageRef);
            return idx !== undefined ? { page: idx + 1, boundary: pos.boundary } : null;
          })
          .filter(Boolean);
        let sealImage = null;
        if (s.sealDataUrl) sealImage = { type: "image", data: s.sealDataUrl };
        else if (s.sealOfd)
          sealImage = {
            type: "svg",
            data: await sealToSvgString(s.sealOfd, 100),
          };
        let sealAttrs = null;
        if (s.sealAttrs) {
          sealAttrs = {
            id: s.sealAttrs.id || "",
            name: s.sealAttrs.name || "",
            type: s.sealAttrs.type || "",
            createTime: formatSignTime(s.sealAttrs.createTime),
            notBefore: formatSignTime(s.sealAttrs.notBefore),
            notAfter: formatSignTime(s.sealAttrs.notAfter),
          };
        }
        return {
          index: i,
          id: s.id,
          signer: s.signer || "",
          signTime: formatSignTime(s.signTime),
          provider: s.provider || "",
          providerVersion: s.providerVersion || "",
          checkMethod: s.checkMethod || "",
          signatureMethod: oidName(s.signatureMethod),
          digestMethod: oidName(s.checkMethod),
          references: (s.references || []).map((r) => ({
            fileRef: r.fileRef,
            checkValue: r.checkValue,
          })),
          signedValuePath: s.signedValuePath || "",
          signedValueSize: s.signedValueSize || 0,
          signaturePath: s.signaturePath || "",
          signatureDigest: s.signatureDigest || "",
          signatureValueHex: s.signatureValueHex || "",
          sealAttrs,
          certValidity: (s.certValidity || []).map((c) => ({
            notBefore: formatAsn1Time(c.notBefore),
            notAfter: formatAsn1Time(c.notAfter),
          })),
          pages: pageNums,
          positions,
          sealImage,
        };
      }),
    );
  }

  // ==================== 公开 API ====================
  const OFD = {
    load,
    renderPage,
    renderPageToString,
    renderAll,
    getPageCount,
    getPageDimensions,
    getDocumentInfo,
    expandDelta,
    getSignatures,
    verifySignature,
    setProfiling: function (on) {
      _profiling = !!on;
      _marks = [];
      if (!on) _lastProfile = null;
    },
    getLastProfile: function () {
      return _lastProfile;
    },
    setFontBase: setFontBase,
    // 非稳定接口，仅为外部实际取用处保留（公共 API 见上方命名导出）：
    //   build/toPdf.js       → base64ToBytes, decodeEntities
    //   test/benchmark.html  → parsePage, readEntry, readEntryText, resolvePath,
    //                          parseXml, hashBytes
    // 需要调试其它内部函数时，请直接在源码中断点。
    _internals: {
      parsePage,
      readEntry,
      readEntryText,
      resolvePath,
      parseXml,
      hashBytes,
      base64ToBytes,
      decodeEntities,
    },
  };

  OFD.version = "1.0.0";
  global.OFD = OFD;
  if (typeof module !== "undefined" && module.exports) module.exports = OFD;
})(typeof window !== "undefined" ? window : this);
