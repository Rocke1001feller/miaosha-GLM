var Xv=Object.defineProperty;var ad=Se=>{throw TypeError(Se)};var Wv=(Se,be,we)=>be in Se?Xv(Se,be,{enumerable:!0,configurable:!0,writable:!0,value:we}):Se[be]=we;var k=(Se,be,we)=>Wv(Se,typeof be!="symbol"?be+"":be,we),Rc=(Se,be,we)=>be.has(Se)||ad("Cannot "+we);var u=(Se,be,we)=>(Rc(Se,be,"read from private field"),we?we.call(Se):be.get(Se)),M=(Se,be,we)=>be.has(Se)?ad("Cannot add the same private member more than once"):be instanceof WeakSet?be.add(Se):be.set(Se,we),T=(Se,be,we,Wn)=>(Rc(Se,be,"write to private field"),Wn?Wn.call(Se,we):be.set(Se,we),we),_=(Se,be,we)=>(Rc(Se,be,"access private method"),we);var id=(Se,be,we,Wn)=>({set _(Xr){T(Se,be,Xr,we)},get _(){return u(Se,be,Wn)}});(function(){"use strict";var ma,yi,Hn,ba,Ho,xi,Un,nt,ht,_i,fr,Pe,ki,re,It,en,Xn,Cc,Ic,Dt,ee,va,St,Mt,Vt,wt,Xt,Fr,Fe,wa,Ei,Wt,ya,jr,ae,Tt,xa,_a,ka,dr,Ea,hr,cn,Sa,P,Uo,rt,Vr,od,Li,tn,Oc,Lc,sd,Ni,Nc,cd,Dc,Kt,pc,Qt,Hr,At,Jt,yt,Bt,qn,Ur,pr,Ta,Si,Ti,$n,Io,je,Kv,Qv,Jv,Mc,qo,$o,Bc,Pc,Aa,gr,qr,Ra,Ca,Ia,Gn,Oa,Rt,Ai,Yn,ln,kn,La,$r,Re,zc,Di,Fc,ld,ud,ja,e0,Mi,jf,un,En,Pt,Gr,Ri,Ci,Lo,Hf,gc,Uf;function Se(t){return t instanceof Uint8Array||ArrayBuffer.isView(t)&&t.constructor.name==="Uint8Array"&&"BYTES_PER_ELEMENT"in t&&t.BYTES_PER_ELEMENT===1}function be(t,e=""){if(typeof t!="number"){const n=e&&`"${e}" `;throw new TypeError(`${n}expected number, got ${typeof t}`)}if(!Number.isSafeInteger(t)||t<0){const n=e&&`"${e}" `;throw new RangeError(`${n}expected integer >= 0, got ${t}`)}}function we(t,e,n=""){const r=Se(t),a=t==null?void 0:t.length,i=e!==void 0;if(!r||i&&a!==e){const s=n&&`"${n}" `,o=i?` of length ${e}`:"",l=r?`length=${a}`:`type=${typeof t}`,c=s+"expected Uint8Array"+o+", got "+l;throw r?new RangeError(c):new TypeError(c)}return t}function Wn(t){if(typeof t!="function"||typeof t.create!="function")throw new TypeError("Hash must wrapped by utils.createHasher");if(be(t.outputLen),be(t.blockLen),t.outputLen<1)throw new Error('"outputLen" must be >= 1');if(t.blockLen<1)throw new Error('"blockLen" must be >= 1')}function Xr(t,e=!0){if(t.destroyed)throw new Error("Hash instance has been destroyed");if(e&&t.finished)throw new Error("Hash#digest() has already been called")}function Uc(t,e){we(t,void 0,"digestInto() output");const n=e.outputLen;if(t.length<n)throw new RangeError('"digestInto() output" expected to be of length >='+n)}function vr(...t){for(let e=0;e<t.length;e++)t[e].fill(0)}function Go(t){return new DataView(t.buffer,t.byteOffset,t.byteLength)}function gn(t,e){return t<<32-e|t>>>e}const qc=typeof Uint8Array.from([]).toHex=="function"&&typeof Uint8Array.fromHex=="function",fd=Array.from({length:256},(t,e)=>e.toString(16).padStart(2,"0"));function Bi(t){if(we(t),qc)return t.toHex();let e="";for(let n=0;n<t.length;n++)e+=fd[t[n]];return e}const Cn={_0:48,_9:57,A:65,F:70,a:97,f:102};function $c(t){if(t>=Cn._0&&t<=Cn._9)return t-Cn._0;if(t>=Cn.A&&t<=Cn.F)return t-(Cn.A-10);if(t>=Cn.a&&t<=Cn.f)return t-(Cn.a-10)}function Yo(t){if(typeof t!="string")throw new TypeError("hex string expected, got "+typeof t);if(qc)try{return Uint8Array.fromHex(t)}catch(a){throw a instanceof SyntaxError?new RangeError(a.message):a}const e=t.length,n=e/2;if(e%2)throw new RangeError("hex string expected, got unpadded hex of length "+e);const r=new Uint8Array(n);for(let a=0,i=0;a<n;a++,i+=2){const s=$c(t.charCodeAt(i)),o=$c(t.charCodeAt(i+1));if(s===void 0||o===void 0){const l=t[i]+t[i+1];throw new RangeError('hex string expected, got non-hex character "'+l+'" at index '+i)}r[a]=s*16+o}return r}function dd(...t){let e=0;for(let r=0;r<t.length;r++){const a=t[r];we(a),e+=a.length}const n=new Uint8Array(e);for(let r=0,a=0;r<t.length;r++){const i=t[r];n.set(i,a),a+=i.length}return n}function Gc(t,e={}){const n=(a,i)=>t(i).update(a).digest(),r=t(void 0);return n.outputLen=r.outputLen,n.blockLen=r.blockLen,n.canXOF=r.canXOF,n.create=a=>t(a),Object.assign(n,e),Object.freeze(n)}function Pi(t=32){be(t,"bytesLength");const e=typeof globalThis=="object"?globalThis.crypto:null;if(typeof(e==null?void 0:e.getRandomValues)!="function")throw new Error("crypto.getRandomValues must be defined");if(t>65536)throw new RangeError(`"bytesLength" expected <= 65536, got ${t}`);return e.getRandomValues(new Uint8Array(t))}const Yc=t=>({oid:Uint8Array.from([6,9,96,134,72,1,101,3,4,2,t])});function hd(t,e,n){return t&e^~t&n}function pd(t,e,n){return t&e^t&n^e&n}class Zc{constructor(e,n,r,a){k(this,"blockLen");k(this,"outputLen");k(this,"canXOF",!1);k(this,"padOffset");k(this,"isLE");k(this,"buffer");k(this,"view");k(this,"finished",!1);k(this,"length",0);k(this,"pos",0);k(this,"destroyed",!1);this.blockLen=e,this.outputLen=n,this.padOffset=r,this.isLE=a,this.buffer=new Uint8Array(e),this.view=Go(this.buffer)}update(e){Xr(this),we(e);const{view:n,buffer:r,blockLen:a}=this,i=e.length;for(let s=0;s<i;){const o=Math.min(a-this.pos,i-s);if(o===a){const l=Go(e);for(;a<=i-s;s+=a)this.process(l,s);continue}r.set(e.subarray(s,s+o),this.pos),this.pos+=o,s+=o,this.pos===a&&(this.process(n,0),this.pos=0)}return this.length+=e.length,this.roundClean(),this}digestInto(e){Xr(this),Uc(e,this),this.finished=!0;const{buffer:n,view:r,blockLen:a,isLE:i}=this;let{pos:s}=this;n[s++]=128,vr(this.buffer.subarray(s)),this.padOffset>a-s&&(this.process(r,0),s=0);for(let p=s;p<a;p++)n[p]=0;r.setBigUint64(a-8,BigInt(this.length*8),i),this.process(r,0);const o=Go(e),l=this.outputLen;if(l%4)throw new Error("_sha2: outputLen must be aligned to 32bit");const c=l/4,f=this.get();if(c>f.length)throw new Error("_sha2: outputLen bigger than state");for(let p=0;p<c;p++)o.setUint32(4*p,f[p],i)}digest(){const{buffer:e,outputLen:n}=this;this.digestInto(e);const r=e.slice(0,n);return this.destroy(),r}_cloneInto(e){e||(e=new this.constructor),e.set(...this.get());const{blockLen:n,buffer:r,length:a,finished:i,destroyed:s,pos:o}=this;return e.destroyed=s,e.finished=i,e.length=a,e.pos=o,a%n&&e.buffer.set(r),e}clone(){return this._cloneInto()}}const Kn=Uint32Array.from([1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225]),ct=Uint32Array.from([1779033703,4089235720,3144134277,2227873595,1013904242,4271175723,2773480762,1595750129,1359893119,2917565137,2600822924,725511199,528734635,4215389547,1541459225,327033209]),zi=BigInt(2**32-1),Vc=BigInt(32);function gd(t,e=!1){return e?{h:Number(t&zi),l:Number(t>>Vc&zi)}:{h:Number(t>>Vc&zi)|0,l:Number(t&zi)|0}}function md(t,e=!1){const n=t.length;let r=new Uint32Array(n),a=new Uint32Array(n);for(let i=0;i<n;i++){const{h:s,l:o}=gd(t[i],e);[r[i],a[i]]=[s,o]}return[r,a]}const Xc=(t,e,n)=>t>>>n,Wc=(t,e,n)=>t<<32-n|e>>>n,Wr=(t,e,n)=>t>>>n|e<<32-n,Kr=(t,e,n)=>t<<32-n|e>>>n,Fi=(t,e,n)=>t<<64-n|e>>>n-32,ji=(t,e,n)=>t>>>n-32|e<<64-n;function In(t,e,n,r){const a=(e>>>0)+(r>>>0);return{h:t+n+(a/2**32|0)|0,l:a|0}}const bd=(t,e,n)=>(t>>>0)+(e>>>0)+(n>>>0),vd=(t,e,n,r)=>e+n+r+(t/2**32|0)|0,wd=(t,e,n,r)=>(t>>>0)+(e>>>0)+(n>>>0)+(r>>>0),yd=(t,e,n,r,a)=>e+n+r+a+(t/2**32|0)|0,xd=(t,e,n,r,a)=>(t>>>0)+(e>>>0)+(n>>>0)+(r>>>0)+(a>>>0),_d=(t,e,n,r,a,i)=>e+n+r+a+i+(t/2**32|0)|0,kd=Uint32Array.from([1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298]),Qn=new Uint32Array(64);class Ed extends Zc{constructor(e){super(64,e,8,!1)}get(){const{A:e,B:n,C:r,D:a,E:i,F:s,G:o,H:l}=this;return[e,n,r,a,i,s,o,l]}set(e,n,r,a,i,s,o,l){this.A=e|0,this.B=n|0,this.C=r|0,this.D=a|0,this.E=i|0,this.F=s|0,this.G=o|0,this.H=l|0}process(e,n){for(let p=0;p<16;p++,n+=4)Qn[p]=e.getUint32(n,!1);for(let p=16;p<64;p++){const d=Qn[p-15],m=Qn[p-2],g=gn(d,7)^gn(d,18)^d>>>3,v=gn(m,17)^gn(m,19)^m>>>10;Qn[p]=v+Qn[p-7]+g+Qn[p-16]|0}let{A:r,B:a,C:i,D:s,E:o,F:l,G:c,H:f}=this;for(let p=0;p<64;p++){const d=gn(o,6)^gn(o,11)^gn(o,25),m=f+d+hd(o,l,c)+kd[p]+Qn[p]|0,v=(gn(r,2)^gn(r,13)^gn(r,22))+pd(r,a,i)|0;f=c,c=l,l=o,o=s+m|0,s=i,i=a,a=r,r=m+v|0}r=r+this.A|0,a=a+this.B|0,i=i+this.C|0,s=s+this.D|0,o=o+this.E|0,l=l+this.F|0,c=c+this.G|0,f=f+this.H|0,this.set(r,a,i,s,o,l,c,f)}roundClean(){vr(Qn)}destroy(){this.destroyed=!0,this.set(0,0,0,0,0,0,0,0),vr(this.buffer)}}class Sd extends Ed{constructor(){super(32);k(this,"A",Kn[0]|0);k(this,"B",Kn[1]|0);k(this,"C",Kn[2]|0);k(this,"D",Kn[3]|0);k(this,"E",Kn[4]|0);k(this,"F",Kn[5]|0);k(this,"G",Kn[6]|0);k(this,"H",Kn[7]|0)}}const Kc=md(["0x428a2f98d728ae22","0x7137449123ef65cd","0xb5c0fbcfec4d3b2f","0xe9b5dba58189dbbc","0x3956c25bf348b538","0x59f111f1b605d019","0x923f82a4af194f9b","0xab1c5ed5da6d8118","0xd807aa98a3030242","0x12835b0145706fbe","0x243185be4ee4b28c","0x550c7dc3d5ffb4e2","0x72be5d74f27b896f","0x80deb1fe3b1696b1","0x9bdc06a725c71235","0xc19bf174cf692694","0xe49b69c19ef14ad2","0xefbe4786384f25e3","0x0fc19dc68b8cd5b5","0x240ca1cc77ac9c65","0x2de92c6f592b0275","0x4a7484aa6ea6e483","0x5cb0a9dcbd41fbd4","0x76f988da831153b5","0x983e5152ee66dfab","0xa831c66d2db43210","0xb00327c898fb213f","0xbf597fc7beef0ee4","0xc6e00bf33da88fc2","0xd5a79147930aa725","0x06ca6351e003826f","0x142929670a0e6e70","0x27b70a8546d22ffc","0x2e1b21385c26c926","0x4d2c6dfc5ac42aed","0x53380d139d95b3df","0x650a73548baf63de","0x766a0abb3c77b2a8","0x81c2c92e47edaee6","0x92722c851482353b","0xa2bfe8a14cf10364","0xa81a664bbc423001","0xc24b8b70d0f89791","0xc76c51a30654be30","0xd192e819d6ef5218","0xd69906245565a910","0xf40e35855771202a","0x106aa07032bbd1b8","0x19a4c116b8d2d0c8","0x1e376c085141ab53","0x2748774cdf8eeb99","0x34b0bcb5e19b48a8","0x391c0cb3c5c95a63","0x4ed8aa4ae3418acb","0x5b9cca4f7763e373","0x682e6ff3d6b2b8a3","0x748f82ee5defb2fc","0x78a5636f43172f60","0x84c87814a1f0ab72","0x8cc702081a6439ec","0x90befffa23631e28","0xa4506cebde82bde9","0xbef9a3f7b2c67915","0xc67178f2e372532b","0xca273eceea26619c","0xd186b8c721c0c207","0xeada7dd6cde0eb1e","0xf57d4f7fee6ed178","0x06f067aa72176fba","0x0a637dc5a2c898a6","0x113f9804bef90dae","0x1b710b35131c471b","0x28db77f523047d84","0x32caab7b40c72493","0x3c9ebe0a15c9bebc","0x431d67c49c100d4c","0x4cc5d4becb3e42b6","0x597f299cfc657e2a","0x5fcb6fab3ad6faec","0x6c44198c4a475817"].map(t=>BigInt(t))),Td=Kc[0],Ad=Kc[1],Jn=new Uint32Array(80),er=new Uint32Array(80);class Rd extends Zc{constructor(e){super(128,e,16,!1)}get(){const{Ah:e,Al:n,Bh:r,Bl:a,Ch:i,Cl:s,Dh:o,Dl:l,Eh:c,El:f,Fh:p,Fl:d,Gh:m,Gl:g,Hh:v,Hl:w}=this;return[e,n,r,a,i,s,o,l,c,f,p,d,m,g,v,w]}set(e,n,r,a,i,s,o,l,c,f,p,d,m,g,v,w){this.Ah=e|0,this.Al=n|0,this.Bh=r|0,this.Bl=a|0,this.Ch=i|0,this.Cl=s|0,this.Dh=o|0,this.Dl=l|0,this.Eh=c|0,this.El=f|0,this.Fh=p|0,this.Fl=d|0,this.Gh=m|0,this.Gl=g|0,this.Hh=v|0,this.Hl=w|0}process(e,n){for(let E=0;E<16;E++,n+=4)Jn[E]=e.getUint32(n),er[E]=e.getUint32(n+=4);for(let E=16;E<80;E++){const R=Jn[E-15]|0,C=er[E-15]|0,N=Wr(R,C,1)^Wr(R,C,8)^Xc(R,C,7),D=Kr(R,C,1)^Kr(R,C,8)^Wc(R,C,7),I=Jn[E-2]|0,F=er[E-2]|0,G=Wr(I,F,19)^Fi(I,F,61)^Xc(I,F,6),oe=Kr(I,F,19)^ji(I,F,61)^Wc(I,F,6),B=wd(D,oe,er[E-7],er[E-16]),$=yd(B,N,G,Jn[E-7],Jn[E-16]);Jn[E]=$|0,er[E]=B|0}let{Ah:r,Al:a,Bh:i,Bl:s,Ch:o,Cl:l,Dh:c,Dl:f,Eh:p,El:d,Fh:m,Fl:g,Gh:v,Gl:w,Hh:x,Hl:S}=this;for(let E=0;E<80;E++){const R=Wr(p,d,14)^Wr(p,d,18)^Fi(p,d,41),C=Kr(p,d,14)^Kr(p,d,18)^ji(p,d,41),N=p&m^~p&v,D=d&g^~d&w,I=xd(S,C,D,Ad[E],er[E]),F=_d(I,x,R,N,Td[E],Jn[E]),G=I|0,oe=Wr(r,a,28)^Fi(r,a,34)^Fi(r,a,39),B=Kr(r,a,28)^ji(r,a,34)^ji(r,a,39),$=r&i^r&o^i&o,Z=a&s^a&l^s&l;x=v|0,S=w|0,v=m|0,w=g|0,m=p|0,g=d|0,{h:p,l:d}=In(c|0,f|0,F|0,G|0),c=o|0,f=l|0,o=i|0,l=s|0,i=r|0,s=a|0;const te=bd(G,B,Z);r=vd(te,F,oe,$),a=te|0}({h:r,l:a}=In(this.Ah|0,this.Al|0,r|0,a|0)),{h:i,l:s}=In(this.Bh|0,this.Bl|0,i|0,s|0),{h:o,l}=In(this.Ch|0,this.Cl|0,o|0,l|0),{h:c,l:f}=In(this.Dh|0,this.Dl|0,c|0,f|0),{h:p,l:d}=In(this.Eh|0,this.El|0,p|0,d|0),{h:m,l:g}=In(this.Fh|0,this.Fl|0,m|0,g|0),{h:v,l:w}=In(this.Gh|0,this.Gl|0,v|0,w|0),{h:x,l:S}=In(this.Hh|0,this.Hl|0,x|0,S|0),this.set(r,a,i,s,o,l,c,f,p,d,m,g,v,w,x,S)}roundClean(){vr(Jn,er)}destroy(){this.destroyed=!0,vr(this.buffer),this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)}}class Cd extends Rd{constructor(){super(64);k(this,"Ah",ct[0]|0);k(this,"Al",ct[1]|0);k(this,"Bh",ct[2]|0);k(this,"Bl",ct[3]|0);k(this,"Ch",ct[4]|0);k(this,"Cl",ct[5]|0);k(this,"Dh",ct[6]|0);k(this,"Dl",ct[7]|0);k(this,"Eh",ct[8]|0);k(this,"El",ct[9]|0);k(this,"Fh",ct[10]|0);k(this,"Fl",ct[11]|0);k(this,"Gh",ct[12]|0);k(this,"Gl",ct[13]|0);k(this,"Hh",ct[14]|0);k(this,"Hl",ct[15]|0)}}const Ha=Gc(()=>new Sd,Yc(1)),Id=Gc(()=>new Cd,Yc(3)),nn="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",Od=(()=>{const t=new Map;for(let e=0;e<nn.length;e++)t.set(nn[e],e);return t})();function Qr(t){return new TextEncoder().encode(t)}function Hi(t){let e="",n=0;for(;n+2<t.length;n+=3){const a=t[n]<<16|t[n+1]<<8|t[n+2];e+=nn[a>>>18&63]+nn[a>>>12&63]+nn[a>>>6&63]+nn[a&63]}const r=t.length-n;if(r===1){const a=t[n]<<16;e+=nn[a>>>18&63]+nn[a>>>12&63]}else if(r===2){const a=t[n]<<16|t[n+1]<<8;e+=nn[a>>>18&63]+nn[a>>>12&63]+nn[a>>>6&63]}return e}function Ld(t){const e=t.replace(/=+$/,""),n=new Uint8Array(Math.floor(e.length*6/8));let r=0,a=0,i=0;for(const s of e){const o=Od.get(s);if(o===void 0)throw new Error(`invalid base64url character: ${s}`);r=r<<6|o,a+=6,a>=8&&(a-=8,n[i++]=r>>>a&255)}return n.subarray(0,i)}function mn(t){return Bi(Ha(typeof t=="string"?Qr(t):t))}function Ui(t){return JSON.stringify(Zo(t))}function Zo(t){if(Array.isArray(t))return t.map(Zo);if(t!==null&&typeof t=="object"){const e=t,n={};for(const r of Object.keys(e).sort()){const a=e[r];a!==void 0&&(n[r]=Zo(a))}return n}return t}function Nd(t){return mn(t)}/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const pt=(t,e,n)=>we(t,e,n),Qc=be,Jc=Bi,el=(...t)=>dd(...t),Dd=t=>Yo(t),Md=Se,Bd=t=>Pi(t),qi=BigInt(0),Vo=BigInt(1);function $i(t,e=""){if(typeof t!="boolean"){const n=e&&`"${e}" `;throw new TypeError(n+"expected boolean, got type="+typeof t)}return t}function Pd(t){if(typeof t=="bigint"){if(!Gi(t))throw new RangeError("positive bigint expected, got "+t)}else Qc(t);return t}function Xo(t,e=""){if(typeof t!="number"){const n=e&&`"${e}" `;throw new TypeError(n+"expected number, got type="+typeof t)}if(!Number.isSafeInteger(t)){const n=e&&`"${e}" `;throw new RangeError(n+"expected safe integer, got "+t)}}function tl(t){if(typeof t!="string")throw new TypeError("hex string expected, got "+typeof t);return t===""?qi:BigInt("0x"+t)}function zd(t){return tl(Bi(t))}function Ua(t){return tl(Bi(Wo(we(t)).reverse()))}function nl(t,e){if(be(e),e===0)throw new RangeError("zero length");t=Pd(t);const n=t.toString(16);if(n.length>e*2)throw new RangeError("number too large");return Yo(n.padStart(e*2,"0"))}function Fd(t,e){return nl(t,e).reverse()}function jd(t,e){if(t=pt(t),e=pt(e),t.length!==e.length)return!1;let n=0;for(let r=0;r<t.length;r++)n|=t[r]^e[r];return n===0}function Wo(t){return Uint8Array.from(pt(t))}const Gi=t=>typeof t=="bigint"&&qi<=t;function Hd(t,e,n){return Gi(t)&&Gi(e)&&Gi(n)&&e<=t&&t<n}function rl(t,e,n,r){if(!Hd(e,n,r))throw new RangeError("expected valid "+t+": "+n+" <= n < "+r+", got "+e)}function Ud(t){if(t<qi)throw new Error("expected non-negative bigint, got "+t);let e;for(e=0;t>qi;t>>=Vo,e+=1);return e}const qd=t=>(Vo<<BigInt(t))-Vo;function Ko(t,e={},n={}){if(Object.prototype.toString.call(t)!=="[object Object]")throw new TypeError("expected valid options object");function r(i,s,o){if(!o&&s!=="function"&&!Object.hasOwn(t,i))throw new TypeError(`param "${i}" is invalid: expected own property`);const l=t[i];if(o&&l===void 0)return;const c=typeof l;if(c!==s||l===null)throw new TypeError(`param "${i}" is invalid: expected ${s}, got ${c}`)}const a=(i,s)=>Object.entries(i).forEach(([o,l])=>r(o,l,s));a(e,!1),a(n,!0)}const al=()=>{throw new Error("not implemented")};/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const lt=BigInt(0),at=BigInt(1),wr=BigInt(2),il=BigInt(3),ol=BigInt(4),sl=BigInt(5),$d=BigInt(7),cl=BigInt(8),Gd=BigInt(9),ll=BigInt(16);function Ge(t,e){if(e<=lt)throw new Error("mod: expected positive modulus, got "+e);const n=t%e;return n>=lt?n:e+n}function bn(t,e,n){if(e<lt)throw new Error("pow2: expected non-negative exponent, got "+e);let r=t;for(;e-- >lt;)r*=r,r%=n;return r}function ul(t,e){if(t===lt)throw new Error("invert: expected non-zero number");if(e<=lt)throw new Error("invert: expected positive modulus, got "+e);let n=Ge(t,e),r=e,a=lt,i=at;for(;n!==lt;){const o=r/n,l=r-n*o,c=a-i*o;r=n,n=l,a=i,i=c}if(r!==at)throw new Error("invert: does not exist");return Ge(a,e)}function Qo(t,e,n){const r=t;if(!r.eql(r.sqr(e),n))throw new Error("Cannot find square root")}function fl(t,e){const n=t,r=(n.ORDER+at)/ol,a=n.pow(e,r);return Qo(n,a,e),a}function Yd(t,e){const n=t,r=(n.ORDER-sl)/cl,a=n.mul(e,wr),i=n.pow(a,r),s=n.mul(e,i),o=n.mul(n.mul(s,wr),i),l=n.mul(s,n.sub(o,n.ONE));return Qo(n,l,e),l}function Zd(t){const e=Jo(t),n=dl(t),r=n(e,e.neg(e.ONE)),a=n(e,r),i=n(e,e.neg(r)),s=(t+$d)/ll;return((o,l)=>{const c=o;let f=c.pow(l,s),p=c.mul(f,r);const d=c.mul(f,a),m=c.mul(f,i),g=c.eql(c.sqr(p),l),v=c.eql(c.sqr(d),l);f=c.cmov(f,p,g),p=c.cmov(m,d,v);const w=c.eql(c.sqr(p),l),x=c.cmov(f,p,w);return Qo(c,x,l),x})}function dl(t){if(t<il)throw new Error("sqrt is not defined for small field");let e=t-at,n=0;for(;e%wr===lt;)e/=wr,n++;let r=wr;const a=Jo(t);for(;pl(a,r)===1;)if(r++>1e3)throw new Error("Cannot find square root: probably non-prime P");if(n===1)return fl;let i=a.pow(r,e);const s=(e+at)/wr;return function(l,c){const f=l;if(f.is0(c))return c;if(pl(f,c)!==1)throw new Error("Cannot find square root");let p=n,d=f.mul(f.ONE,i),m=f.pow(c,e),g=f.pow(c,s);for(;!f.eql(m,f.ONE);){if(f.is0(m))return f.ZERO;let v=1,w=f.sqr(m);for(;!f.eql(w,f.ONE);)if(v++,w=f.sqr(w),v===p)throw new Error("Cannot find square root");const x=at<<BigInt(p-v-1),S=f.pow(d,x);p=v,d=f.sqr(S),m=f.mul(m,d),g=f.mul(g,S)}return g}}function Vd(t){return t%ol===il?fl:t%cl===sl?Yd:t%ll===Gd?Zd(t):dl(t)}const yr=(t,e)=>(Ge(t,e)&at)===at,Xd=["create","isValid","is0","neg","inv","sqrt","sqr","eql","add","sub","mul","pow","div","addN","subN","mulN","sqrN"];function Wd(t){const e={ORDER:"bigint",BYTES:"number",BITS:"number"},n=Xd.reduce((r,a)=>(r[a]="function",r),e);if(Ko(t,n),Xo(t.BYTES,"BYTES"),Xo(t.BITS,"BITS"),t.BYTES<1||t.BITS<1)throw new Error("invalid field: expected BYTES/BITS > 0");if(t.ORDER<=at)throw new Error("invalid field: expected ORDER > 1, got "+t.ORDER);return t}function Kd(t,e,n){const r=t;if(n<lt)throw new Error("invalid exponent, negatives unsupported");if(n===lt)return r.ONE;if(n===at)return e;let a=r.ONE,i=e;for(;n>lt;)n&at&&(a=r.mul(a,i)),i=r.sqr(i),n>>=at;return a}function hl(t,e,n=!1){const r=t,a=new Array(e.length).fill(n?r.ZERO:void 0),i=e.reduce((o,l,c)=>r.is0(l)?o:(a[c]=o,r.mul(o,l)),r.ONE),s=r.inv(i);return e.reduceRight((o,l,c)=>r.is0(l)?o:(a[c]=r.mul(o,a[c]),r.mul(o,l)),s),a}function pl(t,e){const n=t,r=(n.ORDER-at)/wr,a=n.pow(e,r),i=n.eql(a,n.ONE),s=n.eql(a,n.ZERO),o=n.eql(a,n.neg(n.ONE));if(!i&&!s&&!o)throw new Error("invalid Legendre symbol result");return i?1:s?0:-1}function Qd(t,e){if(e!==void 0&&Qc(e),t<=lt)throw new Error("invalid n length: expected positive n, got "+t);if(e!==void 0&&e<1)throw new Error("invalid n length: expected positive bit length, got "+e);const n=Ud(t);if(e!==void 0&&e<n)throw new Error(`invalid n length: expected bit length (${n}) >= n.length (${e})`);const r=e!==void 0?e:n,a=Math.ceil(r/8);return{nBitLength:r,nByteLength:a}}const gl=new WeakMap;class ml{constructor(e,n={}){k(this,"ORDER");k(this,"BITS");k(this,"BYTES");k(this,"isLE");k(this,"ZERO",lt);k(this,"ONE",at);k(this,"_lengths");k(this,"_mod");if(e<=at)throw new Error("invalid field: expected ORDER > 1, got "+e);let r;this.isLE=!1,n!=null&&typeof n=="object"&&(typeof n.BITS=="number"&&(r=n.BITS),typeof n.sqrt=="function"&&Object.defineProperty(this,"sqrt",{value:n.sqrt,enumerable:!0}),typeof n.isLE=="boolean"&&(this.isLE=n.isLE),n.allowedLengths&&(this._lengths=Object.freeze(n.allowedLengths.slice())),typeof n.modFromBytes=="boolean"&&(this._mod=n.modFromBytes));const{nBitLength:a,nByteLength:i}=Qd(e,r);if(i>2048)throw new Error("invalid field: expected ORDER of <= 2048 bytes");this.ORDER=e,this.BITS=a,this.BYTES=i,Object.freeze(this)}create(e){return Ge(e,this.ORDER)}isValid(e){if(typeof e!="bigint")throw new TypeError("invalid field element: expected bigint, got "+typeof e);return lt<=e&&e<this.ORDER}is0(e){return e===lt}isValidNot0(e){return!this.is0(e)&&this.isValid(e)}isOdd(e){return(e&at)===at}neg(e){return Ge(-e,this.ORDER)}eql(e,n){return e===n}sqr(e){return Ge(e*e,this.ORDER)}add(e,n){return Ge(e+n,this.ORDER)}sub(e,n){return Ge(e-n,this.ORDER)}mul(e,n){return Ge(e*n,this.ORDER)}pow(e,n){return Kd(this,e,n)}div(e,n){return Ge(e*ul(n,this.ORDER),this.ORDER)}sqrN(e){return e*e}addN(e,n){return e+n}subN(e,n){return e-n}mulN(e,n){return e*n}inv(e){return ul(e,this.ORDER)}sqrt(e){let n=gl.get(this);return n||gl.set(this,n=Vd(this.ORDER)),n(this,e)}toBytes(e){return this.isLE?Fd(e,this.BYTES):nl(e,this.BYTES)}fromBytes(e,n=!1){pt(e);const{_lengths:r,BYTES:a,isLE:i,ORDER:s,_mod:o}=this;if(r){if(e.length<1||!r.includes(e.length)||e.length>a)throw new Error("Field.fromBytes: expected "+r+" bytes, got "+e.length);const c=new Uint8Array(a);c.set(e,i?0:c.length-e.length),e=c}if(e.length!==a)throw new Error("Field.fromBytes: expected "+a+" bytes, got "+e.length);let l=i?Ua(e):zd(e);if(o&&(l=Ge(l,s)),!n&&!this.isValid(l))throw new Error("invalid field element: outside of range 0..ORDER");return l}invertBatch(e){return hl(this,e)}cmov(e,n,r){return $i(r,"condition"),r?n:e}}Object.freeze(ml.prototype);function Jo(t,e={}){return new ml(t,e)}/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const Yi=BigInt(0),es=BigInt(1);function bl(t,e){const n=e.negate();return t?n:e}function ts(t,e){const n=hl(t.Fp,e.map(r=>r.Z));return e.map((r,a)=>t.fromAffine(r.toAffine(n[a])))}function vl(t,e){if(!Number.isSafeInteger(t)||t<=0||t>e)throw new Error("invalid window size, expected [1.."+e+"], got W="+t)}function ns(t,e){vl(t,e);const n=Math.ceil(e/t)+1,r=2**(t-1),a=2**t,i=qd(t),s=BigInt(t);return{windows:n,windowSize:r,mask:i,maxNumber:a,shiftBy:s}}function wl(t,e,n){const{windowSize:r,mask:a,maxNumber:i,shiftBy:s}=n;let o=Number(t&a),l=t>>s;o>r&&(o-=i,l+=es);const c=e*r,f=c+Math.abs(o)-1,p=o===0,d=o<0,m=e%2!==0;return{nextN:l,offset:f,isZero:p,isNeg:d,isNegF:m,offsetF:c}}const rs=new WeakMap,yl=new WeakMap;function as(t){return yl.get(t)||1}function xl(t){if(t!==Yi)throw new Error("invalid wNAF")}class Jd{constructor(e,n){k(this,"BASE");k(this,"ZERO");k(this,"Fn");k(this,"bits");this.BASE=e.BASE,this.ZERO=e.ZERO,this.Fn=e.Fn,this.bits=n}_unsafeLadder(e,n,r=this.ZERO){let a=e;for(;n>Yi;)n&es&&(r=r.add(a)),a=a.double(),n>>=es;return r}precomputeWindow(e,n){const{windows:r,windowSize:a}=ns(n,this.bits),i=[];let s=e,o=s;for(let l=0;l<r;l++){o=s,i.push(o);for(let c=1;c<a;c++)o=o.add(s),i.push(o);s=o.double()}return i}wNAF(e,n,r){if(!this.Fn.isValid(r))throw new Error("invalid scalar");let a=this.ZERO,i=this.BASE;const s=ns(e,this.bits);for(let o=0;o<s.windows;o++){const{nextN:l,offset:c,isZero:f,isNeg:p,isNegF:d,offsetF:m}=wl(r,o,s);r=l,f?i=i.add(bl(d,n[m])):a=a.add(bl(p,n[c]))}return xl(r),{p:a,f:i}}wNAFUnsafe(e,n,r,a=this.ZERO){const i=ns(e,this.bits);for(let s=0;s<i.windows&&r!==Yi;s++){const{nextN:o,offset:l,isZero:c,isNeg:f}=wl(r,s,i);if(r=o,!c){const p=n[l];a=a.add(f?p.negate():p)}}return xl(r),a}getPrecomputes(e,n,r){let a=rs.get(n);return a||(a=this.precomputeWindow(n,e),e!==1&&(typeof r=="function"&&(a=r(a)),rs.set(n,a))),a}cached(e,n,r){const a=as(e);return this.wNAF(a,this.getPrecomputes(a,e,r),n)}unsafe(e,n,r,a){const i=as(e);return i===1?this._unsafeLadder(e,n,a):this.wNAFUnsafe(i,this.getPrecomputes(i,e,r),n,a)}createCache(e,n){vl(n,this.bits),yl.set(e,n),rs.delete(e)}hasCache(e){return as(e)!==1}}function _l(t,e,n){if(e){if(e.ORDER!==t)throw new Error("Field.ORDER must match order: Fp == p, Fn == n");return Wd(e),e}else return Jo(t,{isLE:n})}function eh(t,e,n={},r){if(r===void 0&&(r=t==="edwards"),!e||typeof e!="object")throw new Error(`expected valid ${t} CURVE object`);for(const l of["p","n","h"]){const c=e[l];if(!(typeof c=="bigint"&&c>Yi))throw new Error(`CURVE.${l} must be positive bigint`)}const a=_l(e.p,n.Fp,r),i=_l(e.n,n.Fn,r),o=["Gx","Gy","a","d"];for(const l of o)if(!a.isValid(e[l]))throw new Error(`CURVE.${l} must be valid field element of CURVE.Fp`);return e=Object.freeze(Object.assign({},e)),{CURVE:e,Fp:a,Fn:i}}function th(t,e){return function(r){const a=t(r);return{secretKey:a,publicKey:e(a)}}}/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const tr=BigInt(0),We=BigInt(1),is=BigInt(2),nh=BigInt(8);function rh(t,e,n,r){const a=t.sqr(n),i=t.sqr(r),s=t.add(t.mul(e.a,a),i),o=t.add(t.ONE,t.mul(e.d,t.mul(a,i)));return t.eql(s,o)}function ah(t,e={}){const n=e,r=eh("edwards",t,n,n.FpFnLE),{Fp:a,Fn:i}=r;let s=r.CURVE;const{h:o}=s;Ko(n,{},{uvRatio:"function"});const l=is<<BigInt(i.BYTES*8)-We,c=w=>a.create(w),f=n.uvRatio===void 0?(w,x)=>{try{return{isValid:!0,value:a.sqrt(a.div(w,x))}}catch{return{isValid:!1,value:tr}}}:n.uvRatio;if(!rh(a,s,s.Gx,s.Gy))throw new Error("bad curve params: generator point");function p(w,x,S=!1){const E=S?We:tr;return rl("coordinate "+w,x,E,l),x}function d(w){if(!(w instanceof m))throw new Error("EdwardsPoint expected")}const v=class v{constructor(x,S,E,R){k(this,"X");k(this,"Y");k(this,"Z");k(this,"T");this.X=p("x",x),this.Y=p("y",S),this.Z=p("z",E,!0),this.T=p("t",R),Object.freeze(this)}static CURVE(){return s}static fromAffine(x){if(x instanceof v)throw new Error("extended point not allowed");const{x:S,y:E}=x||{};return p("x",S),p("y",E),new v(S,E,We,c(S*E))}static fromBytes(x,S=!1){const E=a.BYTES,{a:R,d:C}=s;x=Wo(pt(x,E,"point")),$i(S,"zip215");const N=Wo(x),D=x[E-1];N[E-1]=D&-129;const I=Ua(N),F=S?l:a.ORDER;rl("point.y",I,tr,F);const G=c(I*I),oe=c(G-We),B=c(C*G-R);let{isValid:$,value:Z}=f(oe,B);if(!$)throw new Error("bad point: invalid y coordinate");const te=(Z&We)===We,se=(D&128)!==0;if(!S&&Z===tr&&se)throw new Error("bad point: x=0 and x_0=1");return se!==te&&(Z=c(-Z)),v.fromAffine({x:Z,y:I})}static fromHex(x,S=!1){return v.fromBytes(Dd(x),S)}get x(){return this.toAffine().x}get y(){return this.toAffine().y}precompute(x=8,S=!0){return g.createCache(this,x),S||this.multiply(is),this}assertValidity(){const x=this,{a:S,d:E}=s;if(x.is0())throw new Error("bad point: ZERO");const{X:R,Y:C,Z:N,T:D}=x,I=c(R*R),F=c(C*C),G=c(N*N),oe=c(G*G),B=c(I*S),$=c(G*c(B+F)),Z=c(oe+c(E*c(I*F)));if($!==Z)throw new Error("bad point: equation left != right (1)");const te=c(R*C),se=c(N*D);if(te!==se)throw new Error("bad point: equation left != right (2)")}equals(x){d(x);const{X:S,Y:E,Z:R}=this,{X:C,Y:N,Z:D}=x,I=c(S*D),F=c(C*R),G=c(E*D),oe=c(N*R);return I===F&&G===oe}is0(){return this.equals(v.ZERO)}negate(){return new v(c(-this.X),this.Y,this.Z,c(-this.T))}double(){const{a:x}=s,{X:S,Y:E,Z:R}=this,C=c(S*S),N=c(E*E),D=c(is*c(R*R)),I=c(x*C),F=S+E,G=c(c(F*F)-C-N),oe=I+N,B=oe-D,$=I-N,Z=c(G*B),te=c(oe*$),se=c(G*$),Ee=c(B*oe);return new v(Z,te,Ee,se)}add(x){d(x);const{a:S,d:E}=s,{X:R,Y:C,Z:N,T:D}=this,{X:I,Y:F,Z:G,T:oe}=x,B=c(R*I),$=c(C*F),Z=c(D*E*oe),te=c(N*G),se=c((R+C)*(I+F)-B-$),Ee=te-Z,Be=te+Z,U=c($-S*B),de=c(se*Ee),ne=c(Be*U),he=c(se*U),ge=c(Ee*Be);return new v(de,ne,ge,he)}subtract(x){return d(x),this.add(x.negate())}multiply(x){if(!i.isValidNot0(x))throw new RangeError("invalid scalar: expected 1 <= sc < curve.n");const{p:S,f:E}=g.cached(this,x,R=>ts(v,R));return ts(v,[S,E])[0]}multiplyUnsafe(x){if(!i.isValid(x))throw new RangeError("invalid scalar: expected 0 <= sc < curve.n");return x===tr?v.ZERO:this.is0()||x===We?this:g.unsafe(this,x,S=>ts(v,S))}isSmallOrder(){return this.clearCofactor().is0()}isTorsionFree(){return g.unsafe(this,s.n).is0()}toAffine(x){const S=this;let E=x;const{X:R,Y:C,Z:N}=S,D=S.is0();E==null&&(E=D?nh:a.inv(N));const I=c(R*E),F=c(C*E),G=a.mul(N,E);if(D)return{x:tr,y:We};if(G!==We)throw new Error("invZ was invalid");return{x:I,y:F}}clearCofactor(){return o===We?this:this.multiplyUnsafe(o)}toBytes(){const{x,y:S}=this.toAffine(),E=a.toBytes(S);return E[E.length-1]|=x&We?128:0,E}toHex(){return Jc(this.toBytes())}toString(){return`<Point ${this.is0()?"ZERO":this.toHex()}>`}};k(v,"BASE",new v(s.Gx,s.Gy,We,c(s.Gx*s.Gy))),k(v,"ZERO",new v(tr,We,We,tr)),k(v,"Fp",a),k(v,"Fn",i);let m=v;const g=new Jd(m,i.BITS);return i.BITS>=8&&m.BASE.precompute(8),Object.freeze(m.prototype),Object.freeze(m),m}class qa{constructor(e){k(this,"ep");this.ep=e}static fromBytes(e){al()}static fromHex(e){al()}get x(){return this.toAffine().x}get y(){return this.toAffine().y}clearCofactor(){return this}assertValidity(){this.ep.assertValidity()}toAffine(e){return this.ep.toAffine(e)}toHex(){return Jc(this.toBytes())}toString(){return this.toHex()}isTorsionFree(){return!0}isSmallOrder(){return!1}add(e){return this.assertSame(e),this.init(this.ep.add(e.ep))}subtract(e){return this.assertSame(e),this.init(this.ep.subtract(e.ep))}multiply(e){return this.init(this.ep.multiply(e))}multiplyUnsafe(e){return this.init(this.ep.multiplyUnsafe(e))}double(){return this.init(this.ep.double())}negate(){return this.init(this.ep.negate())}precompute(e,n){return this.ep.precompute(e,n),this}}k(qa,"BASE"),k(qa,"ZERO"),k(qa,"Fp"),k(qa,"Fn");function ih(t,e,n={}){if(typeof e!="function")throw new Error('"hash" function param is required');const r=e,a=n;Ko(a,{},{adjustScalarBytes:"function",randomBytes:"function",domain:"function",prehash:"function",zip215:"boolean",mapToCurve:"function"});const{prehash:i}=a,{BASE:s,Fp:o,Fn:l}=t,c=r.outputLen,f=2*o.BYTES;if(c!==void 0&&(Xo(c,"hash.outputLen"),c!==f))throw new Error(`hash.outputLen must be ${f}, got ${c}`);const p=a.randomBytes===void 0?Bd:a.randomBytes,d=a.adjustScalarBytes===void 0?B=>B:a.adjustScalarBytes,m=a.domain===void 0?(B,$,Z)=>{if($i(Z,"phflag"),$.length||Z)throw new Error("Contexts/pre-hash are not supported");return B}:a.domain;function g(B){return l.create(Ua(B))}function v(B){const $=D.secretKey;pt(B,D.secretKey,"secretKey");const Z=pt(r(B),2*$,"hashedSecretKey"),te=d(Z.slice(0,$)),se=Z.slice($,2*$),Ee=g(te);return{head:te,prefix:se,scalar:Ee}}function w(B){const{head:$,prefix:Z,scalar:te}=v(B),se=s.multiply(te),Ee=se.toBytes();return{head:$,prefix:Z,scalar:te,point:se,pointBytes:Ee}}function x(B){return w(B).pointBytes}function S(B=Uint8Array.of(),...$){const Z=el(...$);return g(r(m(Z,pt(B,void 0,"context"),!!i)))}function E(B,$,Z={}){B=pt(B,void 0,"message"),i&&(B=i(B));const{prefix:te,scalar:se,pointBytes:Ee}=w($),Be=S(Z.context,te,B),U=s.multiply(Be).toBytes(),de=S(Z.context,U,Ee,B),ne=l.create(Be+de*se);if(!l.isValid(ne))throw new Error("sign failed: invalid s");const he=el(U,l.toBytes(ne));return pt(he,D.signature,"result")}const R={zip215:a.zip215};function C(B,$,Z,te=R){const{context:se}=te,Ee=te.zip215===void 0?!!R.zip215:te.zip215,Be=D.signature;B=pt(B,Be,"signature"),$=pt($,void 0,"message"),Z=pt(Z,D.publicKey,"publicKey"),Ee!==void 0&&$i(Ee,"zip215"),i&&($=i($));const U=Be/2,de=B.subarray(0,U),ne=Ua(B.subarray(U,Be));let he,ge,L;try{he=t.fromBytes(Z,Ee),ge=t.fromBytes(de,Ee),L=s.multiplyUnsafe(ne)}catch{return!1}if(!Ee&&he.isSmallOrder())return!1;const V=S(se,de,Z,$);return ge.add(he.multiplyUnsafe(V)).subtract(L).clearCofactor().is0()}const N=o.BYTES,D={secretKey:N,publicKey:N,signature:2*N,seed:N};function I(B){return B=B===void 0?p(D.seed):B,pt(B,D.seed,"seed")}function F(B){return Md(B)&&B.length===D.secretKey}function G(B,$){try{return!!t.fromBytes(B,$===void 0?R.zip215:$)}catch{return!1}}const oe={getExtendedPublicKey:w,randomSecretKey:I,isValidSecretKey:F,isValidPublicKey:G,toMontgomery(B){const{y:$}=t.fromBytes(B),Z=D.publicKey,te=Z===32;if(!te&&Z!==57)throw new Error("only defined for 25519 and 448");const se=te?o.div(We+$,We-$):o.div($-We,$+We);return o.toBytes(se)},toMontgomerySecret(B){const $=D.secretKey;pt(B,$);const Z=r(B.subarray(0,$));return d(Z).subarray(0,$)}};return Object.freeze(D),Object.freeze(oe),Object.freeze({keygen:th(I,x),getPublicKey:x,sign:E,verify:C,utils:oe,Point:t,lengths:D})}/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */const oh=BigInt(0),$a=BigInt(1),kl=BigInt(2),sh=BigInt(5),ch=BigInt(8),Ga=BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed"),El={p:Ga,n:BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),h:ch,a:BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),d:BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),Gx:BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),Gy:BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")};function lh(t){const e=BigInt(10),n=BigInt(20),r=BigInt(40),a=BigInt(80),i=Ga,o=t*t%i*t%i,l=bn(o,kl,i)*o%i,c=bn(l,$a,i)*t%i,f=bn(c,sh,i)*c%i,p=bn(f,e,i)*f%i,d=bn(p,n,i)*p%i,m=bn(d,r,i)*d%i,g=bn(m,a,i)*m%i,v=bn(g,a,i)*m%i,w=bn(v,e,i)*f%i;return{pow_p_5_8:bn(w,kl,i)*t%i,b2:o}}function uh(t){return t[0]&=248,t[31]&=127,t[31]|=64,t}const os=BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");function Sl(t,e){const n=Ga,r=Ge(e*e*e,n),a=Ge(r*r*e,n),i=lh(t*a).pow_p_5_8;let s=Ge(t*r*i,n);const o=Ge(e*s*s,n),l=s,c=Ge(s*os,n),f=o===t,p=o===Ge(-t,n),d=o===Ge(-t*os,n);return f&&(s=l),(p||d)&&(s=c),yr(s,n)&&(s=Ge(-s,n)),{isValid:f||p,value:s}}const xr=ah(El,{uvRatio:Sl}),_r=xr.Fp,fh=xr.Fn;function dh(t){return ih(xr,Id,Object.assign({adjustScalarBytes:uh,zip215:!0},t))}const ss=dh({}),Tl=os,hh=BigInt("54469307008909316920995813868745141605393597292927456921205312896311721017578"),Al=t=>Sl($a,t),ph=BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),gh=t=>_r.create(Ua(t)&ph),Et=class Et extends qa{constructor(e){super(e)}static fromAffine(e){return new Et(xr.fromAffine(e))}assertSame(e){if(!(e instanceof Et))throw new Error("RistrettoPoint expected")}init(e){return new Et(e)}static fromBytes(e){we(e,32);const{a:n,d:r}=El,a=Ga,i=R=>_r.create(R),s=gh(e);if(!jd(_r.toBytes(s),e)||yr(s,a))throw new Error("invalid ristretto255 encoding 1");const o=i(s*s),l=i($a+n*o),c=i($a-n*o),f=i(l*l),p=i(c*c),d=i(n*r*f-p),{isValid:m,value:g}=Al(i(d*p)),v=i(g*c),w=i(g*v*d);let x=i((s+s)*v);yr(x,a)&&(x=i(-x));const S=i(l*w),E=i(x*S);if(!m||yr(E,a)||S===oh)throw new Error("invalid ristretto255 encoding 2");return new Et(new xr(x,S,$a,E))}static fromHex(e){return Et.fromBytes(Yo(e))}toBytes(){let{X:e,Y:n,Z:r,T:a}=this.ep;const i=Ga,s=w=>_r.create(w),o=s(s(r+n)*s(r-n)),l=s(e*n),c=s(l*l),{value:f}=Al(s(o*c)),p=s(f*o),d=s(f*l),m=s(p*d*a);let g;if(yr(a*m,i)){let w=s(n*Tl),x=s(e*Tl);e=w,n=x,g=s(p*hh)}else g=d;yr(e*m,i)&&(n=s(-n));let v=s((r-n)*g);return yr(v,i)&&(v=s(-v)),_r.toBytes(v)}equals(e){this.assertSame(e);const{X:n,Y:r}=this.ep,{X:a,Y:i}=e.ep,s=c=>_r.create(c),o=s(n*i)===s(r*a),l=s(r*i)===s(n*a);return o||l}is0(){return this.equals(Et.ZERO)}};k(Et,"BASE",new Et(xr.BASE)),k(Et,"ZERO",new Et(xr.ZERO)),k(Et,"Fp",_r),k(Et,"Fn",fh);let Jr=Et;Object.freeze(Jr.BASE),Object.freeze(Jr.ZERO),Object.freeze(Jr.prototype),Object.freeze(Jr);const hc=class hc{constructor(e){k(this,"publicKey");M(this,ma);if(e.length!==32)throw new Error(`ed25519 secret key must be 32 bytes, got ${e.length}`);T(this,ma,new Uint8Array(e)),this.publicKey=ss.getPublicKey(u(this,ma))}static generate(){return new hc(ss.utils.randomSecretKey())}sign(e){return Promise.resolve(ss.sign(e,u(this,ma)))}};ma=new WeakMap;let Zi=hc;function Rl(t){return Hi(t)}function mh(t){const e=Ld(t);if(e.length!==32)throw new Error(`pubkey must decode to 32 bytes, got ${e.length}`);return e}function bh(t){const e=mn(mh(t));return`${e.slice(0,4)}…${e.slice(-4)}`}function Ht(){return Hi(Pi(16))}function vh(t,e){let n=e;for(let r=0;n>0;r++){const a=t[r];if(a!==0)return n<=7&&Math.clz32(a)-24>=n;n-=8}return!0}function wh(t,e,n,r){if(!Number.isInteger(e)||e<0||e>256)throw new Error(`invalid pow bits: ${e}`);if(!Number.isSafeInteger(n)||n<0)throw new Error(`invalid pow startFrom: ${n}`);if(!Number.isSafeInteger(r)||r<=0)throw new Error(`invalid maxIterations: ${r}`);const a=Qr(t),i=new Uint8Array(a.length+20);i.set(a);const s=Ha.create().update(a),o=Ha.create(),l=new Uint8Array(32);let c=1,f=10;for(;f<=n;)c++,f*=10;const p=n+r;for(let d=n;d<p;d++){let m=a.length+c,g=d;do i[--m]=48+g%10,g=Math.floor(g/10);while(g>0);if(s._cloneInto(o),o.update(i.subarray(a.length,a.length+c)).digestInto(l),vh(l,e))return{solution:String(d),nextCounter:d+1};d+1===f&&(c++,f*=10)}return{nextCounter:p}}const yh=65536;async function xh(t,e,n=0){let r=n;for(;;){const a=wh(t,e,r,yh);if(a.solution!==void 0)return a.solution;r=a.nextCounter,await new Promise(i=>setTimeout(i,0))}}function _h(t){return t==null?"-":mn(Ui(t))}function cs(t){return["v=1","op=comment",`project=${t.project}`,`id=${t.id}`,`page_id=${t.pageId}`,`parent_id=${t.parentId??"-"}`,`content_sha256=${Nd(t.contentRaw)}`,`anchor_sha256=${_h(t.anchor)}`,...t.meta!=null?[`meta_sha256=${mn(Ui(t.meta))}`]:[],`client_ts=${t.clientTs}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function Cl(t){return["v=1","op=like",`project=${t.project}`,`target_type=${t.targetType}`,`target_id=${t.targetId}`,`action=${t.action}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function Il(t){return["v=1","op=report",`project=${t.project}`,`comment_id=${t.commentId}`,`reason_sha256=${mn(t.reason)}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function kh(t){return["v=1","op=sync_push",`project=${t.project}`,`ops_sha256=${mn(Ui(t.ops))}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function Eh(t){return["v=1","op=inbox",`project=${t.project}`,`since=${t.since}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function Sh(t){return["v=1","op=admin_queue",`project=${t.project}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function Th(t){return["v=1","op=admin_decide",`project=${t.project}`,`comment_id=${t.commentId}`,`action=${t.action}`,`reason_sha256=${mn(t.reason)}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function Ah(t){return["v=1","op=set_name",`project=${t.project}`,`name_sha256=${mn(t.name)}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function Rh(t){return["v=1","op=admin_patch_project",`project=${t.project}`,`settings_sha256=${mn(Ui(t.settings))}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function Ch(t){return["v=1","op=rescue",`project=${t.project}`,`comment_id=${t.commentId}`,`rescue_type=${t.rescueType}`,`ts=${t.ts}`,`nonce=${t.nonce}`].join(`
`)}function ls(t,e){return t.hostname===e||t.hostname.endsWith(`.${e}`)}function Vi(t){const e=t.replace(/\/+$/,"");return e===""?"":e}const Ih=new Set(["fbclid","gclid","ref"]);function Oh(t){return t.startsWith("utm_")||Ih.has(t)}const Lh=[{name:"youtube",match:t=>t.hostname==="youtu.be"||ls(t,"youtube.com"),normalize:t=>{if(t.hostname==="youtu.be"){const n=t.pathname.split("/").filter(Boolean)[0];return n?`https://www.youtube.com/watch?v=${encodeURIComponent(n)}`:"https://www.youtube.com/"}if(t.pathname==="/watch"){const n=t.searchParams.get("v");return n?`https://www.youtube.com/watch?v=${encodeURIComponent(n)}`:"https://www.youtube.com/watch"}const e=/^\/shorts\/([\w-]+)/.exec(t.pathname);return e?`https://www.youtube.com/watch?v=${encodeURIComponent(e[1])}`:`https://www.youtube.com${Vi(t.pathname)}`}},{name:"x.com",match:t=>/^(www\.|mobile\.)?(x\.com|twitter\.com)$/.test(t.hostname),normalize:t=>`https://x.com${Vi(t.pathname)}`},{name:"instagram.com",match:t=>ls(t,"instagram.com"),normalize:t=>{const e=/^\/(p|reel)\/([^/]+)/.exec(t.pathname);return`https://instagram.com${e?`/${e[1]}/${e[2]}`:Vi(t.pathname)}`}},{name:"wikipedia",match:t=>ls(t,"wikipedia.org"),normalize:t=>`${t.protocol}//${t.host}${t.pathname}`},{name:"default",match:()=>!0,normalize:t=>{const e=new URLSearchParams;for(const[a,i]of t.searchParams)Oh(a)||e.append(a,i);const n=e.toString(),r=t.pathname==="/"?"/":Vi(t.pathname);return`${t.protocol}//${t.host}${r}${n?`?${n}`:""}`}}];function Ol(t,e=[]){const n=t.trim();let r;try{r=new URL(n)}catch{return n}for(const a of[...e,...Lh])if(a.match(r))return a.normalize(r);return n}function Nh(t,e=[]){return mn(Ol(t,e)).slice(0,16)}const Dh=4,Mh=new Set(["SCRIPT","STYLE","NOSCRIPT","TEMPLATE"]);function Xi(t){const n=t.ownerDocument.createTreeWalker(t,Dh,{acceptNode:s=>{const o=s.parentElement;return o&&(Mh.has(o.tagName)||o.closest("[hidden]"))?2:1}}),r=[];let a="",i=n.nextNode();for(;i;){const s=i;r.push({node:s,start:a.length}),a+=s.data,i=n.nextNode()}return{text:a,map:r}}function Bh(t){return Xi(t).text}function Wi(t,e,n,r){if(e!==t&&!t.contains(e))return(t.compareDocumentPosition(e)&4)!==0?r:0;const a=t.ownerDocument.createRange();return a.selectNodeContents(t),a.setEnd(e,n),a.toString().length}function Ph(t,e){if(t===e)return":scope";const n=[];let r=t;for(;r&&r!==e;){let a=r.tagName.toLowerCase();const i=r.getAttribute("id");if(i&&/^[A-Za-z][\w-]*$/.test(i)){n.unshift(`${a}#${i}`);break}const s=r.parentElement;if(s){const o=Array.from(s.children).filter(l=>l.tagName===r.tagName);o.length>1&&(a+=`:nth-of-type(${o.indexOf(r)+1})`)}n.unshift(a),r=s}return n.length>0?n.join(" > "):":scope"}function zh(t,e){if(e.rangeCount===0||e.isCollapsed)return null;const n=e.getRangeAt(0),r=n.toString();if(r.length===0)return null;const{text:a}=Xi(t),i=Wi(t,n.startContainer,n.startOffset,a.length),s=Wi(t,n.endContainer,n.endOffset,a.length),o=Math.min(i,s),l=Math.max(i,s),c=a.slice(Math.max(0,o-32),o),f=a.slice(l,l+32),p=n.commonAncestorContainer,d=p.nodeType===1?p:p.parentElement;if(!d)return null;const m=Bh(d),g=Wi(d,n.startContainer,n.startOffset,m.length),v=Wi(d,n.endContainer,n.endOffset,m.length);return{type:"text",quote:{exact:r,...c?{prefix:c}:{},...f?{suffix:f}:{}},position:{start:o,end:l},range:{container:Ph(d,t),startOffset:Math.min(g,v),endOffset:Math.max(g,v)}}}function Fh(t,e,n,r){if(e.length===0||r<n)return null;const a=l=>{for(let c=0;c<e.length;c++){const f=e[c],p=f.start+f.node.data.length;if(l<=p||c===e.length-1)return{node:f.node,offset:Math.min(Math.max(l-f.start,0),f.node.data.length)}}return null},i=a(n),s=a(r);if(!i||!s)return null;const o=t.createRange();return o.setStart(i.node,i.offset),o.setEnd(s.node,s.offset),o}function jh(t,e){const n=[];let r=t.indexOf(e);for(;r!==-1;)n.push(r),r=t.indexOf(e,r+1);return n}function Hh(t,e){try{return t.matches(e)?t:t.querySelector(e)}catch{return null}}function Uh(t,e,n,r){const a=e.quote.exact,i=jh(n,a);if(i.length===0)return null;let s=null;if(i.length===1)s=i[0];else{const{prefix:o,suffix:l}=e.quote,c=i.filter(f=>!(o!==void 0&&n.slice(f-o.length,f)!==o||l!==void 0&&n.slice(f+a.length,f+a.length+l.length)!==l));if(c.length===1)s=c[0];else return null}return Fh(t.ownerDocument,r,s,s+a.length)}function Ll(t,e,n){if(e.type==="media-time")return null;if(e.type==="container"){const i=Hh(t,e.selector);if(!i)return null;const s=t.ownerDocument.createRange();return s.selectNodeContents(i),s}const{text:r,map:a}=n??Xi(t);return Uh(t,e,r,a)}const us="any-comments";function qh(t,e,n){var i;if(typeof Highlight>"u"||typeof CSS>"u"||!CSS.highlights)return;const r=Xi(t),a=[];for(let s=0;s<e.length;s++)try{const o=((i=n==null?void 0:n.resolved)==null?void 0:i[s])??Ll(t,e[s],r);o&&a.push(o)}catch(o){console.error("[any-comments] resolveAnchor failed（按孤儿降级）:",o)}try{CSS.highlights.set(us,new Highlight(...a))}catch(s){console.error("[any-comments] Highlight 注册失败:",s)}}function $h(){typeof CSS>"u"||!CSS.highlights||(CSS.highlights.delete(us),CSS.highlights.delete(Nl))}const fs="any-comments-highlight-styles",Nl="any-comments-preview";function Gh(t){if(!t.getElementById(fs)){const e=t.createElement("style");e.id=fs,e.textContent=[`::highlight(${us}) { text-decoration-line: underline; text-decoration-style: solid; text-decoration-color: rgba(234, 179, 8, 0.55); text-decoration-thickness: 2px; text-underline-offset: 3px; }`,`::highlight(${Nl}) { background-color: rgba(250, 204, 21, 0.30); text-decoration-line: underline; text-decoration-style: solid; text-decoration-color: #eab308; text-decoration-thickness: 2px; text-underline-offset: 3px; }`].join(`
`),t.head.appendChild(e)}return()=>{var e;(e=t.getElementById(fs))==null||e.remove()}}class Dl{constructor(e,n){k(this,"oHash");k(this,"iHash");k(this,"blockLen");k(this,"outputLen");k(this,"canXOF",!1);k(this,"finished",!1);k(this,"destroyed",!1);if(Wn(e),we(n,void 0,"key"),this.iHash=e.create(),typeof this.iHash.update!="function")throw new Error("Expected instance of class which extends utils.Hash");this.blockLen=this.iHash.blockLen,this.outputLen=this.iHash.outputLen;const r=this.blockLen,a=new Uint8Array(r);a.set(n.length>r?e.create().update(n).digest():n);for(let i=0;i<a.length;i++)a[i]^=54;this.iHash.update(a),this.oHash=e.create();for(let i=0;i<a.length;i++)a[i]^=106;this.oHash.update(a),vr(a)}update(e){return Xr(this),this.iHash.update(e),this}digestInto(e){Xr(this),Uc(e,this),this.finished=!0;const n=e.subarray(0,this.outputLen);this.iHash.digestInto(n),this.oHash.update(n),this.oHash.digestInto(n),this.destroy()}digest(){const e=new Uint8Array(this.oHash.outputLen);return this.digestInto(e),e}_cloneInto(e){e||(e=Object.create(Object.getPrototypeOf(this),{}));const{oHash:n,iHash:r,finished:a,destroyed:i,blockLen:s,outputLen:o}=this;return e=e,e.finished=a,e.destroyed=i,e.blockLen=s,e.outputLen=o,e.oHash=n._cloneInto(e.oHash),e.iHash=r._cloneInto(e.iHash),e}clone(){return this._cloneInto()}destroy(){this.destroyed=!0,this.oHash.destroy(),this.iHash.destroy()}}const Ml=(()=>{const t=((e,n,r)=>new Dl(e,n).update(r).digest());return t.create=(e,n)=>new Dl(e,n),t})();function Yh(t,e,n){return Wn(t),n===void 0&&(n=new Uint8Array(t.outputLen)),Ml(t,n,e)}const ds=Uint8Array.of(0),Bl=Uint8Array.of();function Zh(t,e,n,r=32){Wn(t),be(r,"length"),we(e,void 0,"prk");const a=t.outputLen;if(e.length<a)throw new Error('"prk" must be at least HashLen octets');if(r>255*a)throw new Error("Length must be <= 255*HashLen");const i=Math.ceil(r/a);n===void 0?n=Bl:we(n,void 0,"info");const s=new Uint8Array(i*a),o=Ml.create(t,e),l=o._cloneInto(),c=new Uint8Array(o.outputLen);for(let f=0;f<i;f++)ds[0]=f+1,l.update(f===0?Bl:c).update(n).update(ds).digestInto(c),s.set(c,a*f),o._cloneInto(l);return o.destroy(),l.destroy(),vr(c,ds),s.slice(0,r)}const Vh=(t,e,n,r,a)=>Zh(t,Yh(t,e,n),r,a);/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */function Ki(t){return t instanceof Uint8Array||ArrayBuffer.isView(t)&&t.constructor.name==="Uint8Array"&&"BYTES_PER_ELEMENT"in t&&t.BYTES_PER_ELEMENT===1}function Pl(t,e){return Array.isArray(e)?e.length===0?!0:t?e.every(n=>typeof n=="string"):e.every(n=>Number.isSafeInteger(n)):!1}function Xh(t){if(typeof t!="function")throw new TypeError("function expected");return!0}function Qi(t,e){if(typeof e!="string")throw new TypeError(`${t}: string expected`);return!0}function ea(t){if(typeof t!="number")throw new TypeError(`number expected, got ${typeof t}`);if(!Number.isSafeInteger(t))throw new RangeError(`invalid integer: ${t}`)}function Ji(t){if(!Array.isArray(t))throw new TypeError("array expected")}function eo(t,e){if(!Pl(!0,e))throw new TypeError(`${t}: array of strings expected`)}function zl(t,e){if(!Pl(!1,e))throw new TypeError(`${t}: array of numbers expected`)}function Wh(...t){const e=i=>i,n=(i,s)=>o=>i(s(o)),r=t.map(i=>i.encode).reduceRight(n,e),a=t.map(i=>i.decode).reduce(n,e);return{encode:r,decode:a}}function Kh(t){const e=typeof t=="string"?t.split(""):t,n=e.length;eo("alphabet",e);const r=new Map(e.map((a,i)=>[a,i]));return{encode:a=>(Ji(a),a.map(i=>{if(!Number.isSafeInteger(i)||i<0||i>=n)throw new Error(`alphabet.encode: digit index outside alphabet "${i}". Allowed: ${t}`);return e[i]})),decode:a=>(Ji(a),a.map(i=>{Qi("alphabet.decode",i);const s=r.get(i);if(s===void 0)throw new Error(`Unknown letter: "${i}". Allowed: ${t}`);return s}))}}function Qh(t=""){return Qi("join",t),{encode:e=>(eo("join.decode",e),e.join(t)),decode:e=>(Qi("join.decode",e),e.split(t))}}function Jh(t,e="="){return ea(t),Qi("padding",e),{encode(n){for(eo("padding.encode",n);n.length*t%8;)n.push(e);return n},decode(n){eo("padding.decode",n);let r=n.length;if(r*t%8)throw new Error("padding: invalid, string should have whole number of bytes");for(;r>0&&n[r-1]===e;r--)if((r-1)*t%8===0)throw new Error("padding: invalid, string has too much padding");return n.slice(0,r)}}}function hs(t,e,n){if(e<2)throw new RangeError(`convertRadix: invalid from=${e}, base cannot be less than 2`);if(n<2)throw new RangeError(`convertRadix: invalid to=${n}, base cannot be less than 2`);if(Ji(t),!t.length)return[];let r=0;const a=[],i=Array.from(t,o=>{if(ea(o),o<0||o>=e)throw new Error(`invalid integer: ${o}`);return o}),s=i.length;for(;;){let o=0,l=!0;for(let c=r;c<s;c++){const f=i[c],p=e*o,d=p+f;if(!Number.isSafeInteger(d)||p/e!==o||d-f!==p)throw new Error("convertRadix: carry overflow");const m=d/n;o=d%n;const g=Math.floor(m);if(i[c]=g,!Number.isSafeInteger(g)||g*n+o!==d)throw new Error("convertRadix: carry overflow");if(l)g?l=!1:r=c;else continue}if(a.push(o),l)break}for(let o=0;o<t.length-1&&t[o]===0;o++)a.push(0);return a.reverse()}const Fl=(t,e)=>e===0?t:Fl(e,t%e),to=(t,e)=>t+(e-Fl(t,e)),ps=(()=>{let t=[];for(let e=0;e<40;e++)t.push(2**e);return t})();function gs(t,e,n,r){if(Ji(t),e<=0||e>32)throw new RangeError(`convertRadix2: wrong from=${e}`);if(n<=0||n>32)throw new RangeError(`convertRadix2: wrong to=${n}`);if(to(e,n)>32)throw new Error(`convertRadix2: carry overflow from=${e} to=${n} carryBits=${to(e,n)}`);let a=0,i=0;const s=ps[e],o=ps[n]-1,l=[];for(const c of t){if(ea(c),c>=s)throw new Error(`convertRadix2: invalid data word=${c} from=${e}`);if(a=a<<e|c,i+e>32)throw new Error(`convertRadix2: carry overflow pos=${i} from=${e}`);for(i+=e;i>=n;i-=n)l.push((a>>i-n&o)>>>0);const f=ps[i];if(f===void 0)throw new Error("invalid carry");a&=f-1}if(a=a<<n-i&o,!r&&i>=e)throw new Error("Excess padding");if(!r&&a>0)throw new Error(`Non-zero padding: ${a}`);return r&&i>0&&l.push(a>>>0),l}function ep(t){ea(t);const e=2**8;return{encode:n=>{if(!Ki(n))throw new TypeError("radix.encode input should be Uint8Array");return hs(Array.from(n),e,t)},decode:n=>(zl("radix.decode",n),Uint8Array.from(hs(n,t,e)))}}function tp(t,e=!1){if(ea(t),t<=0||t>32)throw new RangeError("radix2: bits should be in (0..32]");if(to(8,t)>32||to(t,8)>32)throw new RangeError("radix2: carry overflow");return{encode:n=>{if(!Ki(n))throw new TypeError("radix2.encode input should be Uint8Array");return gs(Array.from(n),8,t,!e)},decode:n=>(zl("radix2.decode",n),Uint8Array.from(gs(n,t,8,e)))}}function np(t,e){if(ea(t),t<=0)throw new RangeError(`checksum length must be positive: ${t}`);Xh(e);const n=e;return{encode(r){if(!Ki(r))throw new TypeError("checksum.encode: input should be Uint8Array");const a=n(r).slice(0,t),i=new Uint8Array(r.length+t);return i.set(r),i.set(a,r.length),i},decode(r){if(!Ki(r))throw new TypeError("checksum.decode: input should be Uint8Array");const a=r.slice(0,-t),i=r.slice(-t),s=n(a).slice(0,t);for(let o=0;o<t;o++)if(s[o]!==i[o])throw new Error("Invalid checksum");return a}}}const no=Object.freeze({alphabet:Kh,chain:Wh,checksum:np,convertRadix:hs,convertRadix2:gs,radix:ep,radix2:tp,join:Qh,padding:Jh});/*! scure-bip39 - MIT License (c) 2022 Patricio Palladino, Paul Miller (paulmillr.com) */function rp(t){if(typeof t!="string")throw new TypeError("invalid mnemonic type: "+typeof t);return t.normalize("NFKD")}function ap(t){const e=rp(t),n=e.split(" ");if(![12,15,18,21,24].includes(n.length))throw new Error("Invalid mnemonic");return{nfkd:e,words:n}}function ip(t){if(we(t),![16,20,24,28,32].includes(t.length))throw new RangeError("invalid entropy length")}const op=t=>{const e=8-t.length/4;return new Uint8Array([Ha(t)[0]>>e<<e])};function sp(t){if(!Array.isArray(t)||t.length!==2048||typeof t[0]!="string")throw new TypeError("Wordlist: expected array of 2048 strings");return t.forEach(e=>{if(typeof e!="string")throw new TypeError("wordlist: non-string element: "+e)}),no.chain(no.checksum(1,op),no.radix2(11,!0),no.alphabet(t))}function jl(t,e){const{words:n}=ap(t),r=sp(e).decode(n);return ip(r),r}function cp(t,e){try{jl(t,e)}catch{return!1}return!0}const Hl=Object.freeze(`abandon
ability
able
about
above
absent
absorb
abstract
absurd
abuse
access
accident
account
accuse
achieve
acid
acoustic
acquire
across
act
action
actor
actress
actual
adapt
add
addict
address
adjust
admit
adult
advance
advice
aerobic
affair
afford
afraid
again
age
agent
agree
ahead
aim
air
airport
aisle
alarm
album
alcohol
alert
alien
all
alley
allow
almost
alone
alpha
already
also
alter
always
amateur
amazing
among
amount
amused
analyst
anchor
ancient
anger
angle
angry
animal
ankle
announce
annual
another
answer
antenna
antique
anxiety
any
apart
apology
appear
apple
approve
april
arch
arctic
area
arena
argue
arm
armed
armor
army
around
arrange
arrest
arrive
arrow
art
artefact
artist
artwork
ask
aspect
assault
asset
assist
assume
asthma
athlete
atom
attack
attend
attitude
attract
auction
audit
august
aunt
author
auto
autumn
average
avocado
avoid
awake
aware
away
awesome
awful
awkward
axis
baby
bachelor
bacon
badge
bag
balance
balcony
ball
bamboo
banana
banner
bar
barely
bargain
barrel
base
basic
basket
battle
beach
bean
beauty
because
become
beef
before
begin
behave
behind
believe
below
belt
bench
benefit
best
betray
better
between
beyond
bicycle
bid
bike
bind
biology
bird
birth
bitter
black
blade
blame
blanket
blast
bleak
bless
blind
blood
blossom
blouse
blue
blur
blush
board
boat
body
boil
bomb
bone
bonus
book
boost
border
boring
borrow
boss
bottom
bounce
box
boy
bracket
brain
brand
brass
brave
bread
breeze
brick
bridge
brief
bright
bring
brisk
broccoli
broken
bronze
broom
brother
brown
brush
bubble
buddy
budget
buffalo
build
bulb
bulk
bullet
bundle
bunker
burden
burger
burst
bus
business
busy
butter
buyer
buzz
cabbage
cabin
cable
cactus
cage
cake
call
calm
camera
camp
can
canal
cancel
candy
cannon
canoe
canvas
canyon
capable
capital
captain
car
carbon
card
cargo
carpet
carry
cart
case
cash
casino
castle
casual
cat
catalog
catch
category
cattle
caught
cause
caution
cave
ceiling
celery
cement
census
century
cereal
certain
chair
chalk
champion
change
chaos
chapter
charge
chase
chat
cheap
check
cheese
chef
cherry
chest
chicken
chief
child
chimney
choice
choose
chronic
chuckle
chunk
churn
cigar
cinnamon
circle
citizen
city
civil
claim
clap
clarify
claw
clay
clean
clerk
clever
click
client
cliff
climb
clinic
clip
clock
clog
close
cloth
cloud
clown
club
clump
cluster
clutch
coach
coast
coconut
code
coffee
coil
coin
collect
color
column
combine
come
comfort
comic
common
company
concert
conduct
confirm
congress
connect
consider
control
convince
cook
cool
copper
copy
coral
core
corn
correct
cost
cotton
couch
country
couple
course
cousin
cover
coyote
crack
cradle
craft
cram
crane
crash
crater
crawl
crazy
cream
credit
creek
crew
cricket
crime
crisp
critic
crop
cross
crouch
crowd
crucial
cruel
cruise
crumble
crunch
crush
cry
crystal
cube
culture
cup
cupboard
curious
current
curtain
curve
cushion
custom
cute
cycle
dad
damage
damp
dance
danger
daring
dash
daughter
dawn
day
deal
debate
debris
decade
december
decide
decline
decorate
decrease
deer
defense
define
defy
degree
delay
deliver
demand
demise
denial
dentist
deny
depart
depend
deposit
depth
deputy
derive
describe
desert
design
desk
despair
destroy
detail
detect
develop
device
devote
diagram
dial
diamond
diary
dice
diesel
diet
differ
digital
dignity
dilemma
dinner
dinosaur
direct
dirt
disagree
discover
disease
dish
dismiss
disorder
display
distance
divert
divide
divorce
dizzy
doctor
document
dog
doll
dolphin
domain
donate
donkey
donor
door
dose
double
dove
draft
dragon
drama
drastic
draw
dream
dress
drift
drill
drink
drip
drive
drop
drum
dry
duck
dumb
dune
during
dust
dutch
duty
dwarf
dynamic
eager
eagle
early
earn
earth
easily
east
easy
echo
ecology
economy
edge
edit
educate
effort
egg
eight
either
elbow
elder
electric
elegant
element
elephant
elevator
elite
else
embark
embody
embrace
emerge
emotion
employ
empower
empty
enable
enact
end
endless
endorse
enemy
energy
enforce
engage
engine
enhance
enjoy
enlist
enough
enrich
enroll
ensure
enter
entire
entry
envelope
episode
equal
equip
era
erase
erode
erosion
error
erupt
escape
essay
essence
estate
eternal
ethics
evidence
evil
evoke
evolve
exact
example
excess
exchange
excite
exclude
excuse
execute
exercise
exhaust
exhibit
exile
exist
exit
exotic
expand
expect
expire
explain
expose
express
extend
extra
eye
eyebrow
fabric
face
faculty
fade
faint
faith
fall
false
fame
family
famous
fan
fancy
fantasy
farm
fashion
fat
fatal
father
fatigue
fault
favorite
feature
february
federal
fee
feed
feel
female
fence
festival
fetch
fever
few
fiber
fiction
field
figure
file
film
filter
final
find
fine
finger
finish
fire
firm
first
fiscal
fish
fit
fitness
fix
flag
flame
flash
flat
flavor
flee
flight
flip
float
flock
floor
flower
fluid
flush
fly
foam
focus
fog
foil
fold
follow
food
foot
force
forest
forget
fork
fortune
forum
forward
fossil
foster
found
fox
fragile
frame
frequent
fresh
friend
fringe
frog
front
frost
frown
frozen
fruit
fuel
fun
funny
furnace
fury
future
gadget
gain
galaxy
gallery
game
gap
garage
garbage
garden
garlic
garment
gas
gasp
gate
gather
gauge
gaze
general
genius
genre
gentle
genuine
gesture
ghost
giant
gift
giggle
ginger
giraffe
girl
give
glad
glance
glare
glass
glide
glimpse
globe
gloom
glory
glove
glow
glue
goat
goddess
gold
good
goose
gorilla
gospel
gossip
govern
gown
grab
grace
grain
grant
grape
grass
gravity
great
green
grid
grief
grit
grocery
group
grow
grunt
guard
guess
guide
guilt
guitar
gun
gym
habit
hair
half
hammer
hamster
hand
happy
harbor
hard
harsh
harvest
hat
have
hawk
hazard
head
health
heart
heavy
hedgehog
height
hello
helmet
help
hen
hero
hidden
high
hill
hint
hip
hire
history
hobby
hockey
hold
hole
holiday
hollow
home
honey
hood
hope
horn
horror
horse
hospital
host
hotel
hour
hover
hub
huge
human
humble
humor
hundred
hungry
hunt
hurdle
hurry
hurt
husband
hybrid
ice
icon
idea
identify
idle
ignore
ill
illegal
illness
image
imitate
immense
immune
impact
impose
improve
impulse
inch
include
income
increase
index
indicate
indoor
industry
infant
inflict
inform
inhale
inherit
initial
inject
injury
inmate
inner
innocent
input
inquiry
insane
insect
inside
inspire
install
intact
interest
into
invest
invite
involve
iron
island
isolate
issue
item
ivory
jacket
jaguar
jar
jazz
jealous
jeans
jelly
jewel
job
join
joke
journey
joy
judge
juice
jump
jungle
junior
junk
just
kangaroo
keen
keep
ketchup
key
kick
kid
kidney
kind
kingdom
kiss
kit
kitchen
kite
kitten
kiwi
knee
knife
knock
know
lab
label
labor
ladder
lady
lake
lamp
language
laptop
large
later
latin
laugh
laundry
lava
law
lawn
lawsuit
layer
lazy
leader
leaf
learn
leave
lecture
left
leg
legal
legend
leisure
lemon
lend
length
lens
leopard
lesson
letter
level
liar
liberty
library
license
life
lift
light
like
limb
limit
link
lion
liquid
list
little
live
lizard
load
loan
lobster
local
lock
logic
lonely
long
loop
lottery
loud
lounge
love
loyal
lucky
luggage
lumber
lunar
lunch
luxury
lyrics
machine
mad
magic
magnet
maid
mail
main
major
make
mammal
man
manage
mandate
mango
mansion
manual
maple
marble
march
margin
marine
market
marriage
mask
mass
master
match
material
math
matrix
matter
maximum
maze
meadow
mean
measure
meat
mechanic
medal
media
melody
melt
member
memory
mention
menu
mercy
merge
merit
merry
mesh
message
metal
method
middle
midnight
milk
million
mimic
mind
minimum
minor
minute
miracle
mirror
misery
miss
mistake
mix
mixed
mixture
mobile
model
modify
mom
moment
monitor
monkey
monster
month
moon
moral
more
morning
mosquito
mother
motion
motor
mountain
mouse
move
movie
much
muffin
mule
multiply
muscle
museum
mushroom
music
must
mutual
myself
mystery
myth
naive
name
napkin
narrow
nasty
nation
nature
near
neck
need
negative
neglect
neither
nephew
nerve
nest
net
network
neutral
never
news
next
nice
night
noble
noise
nominee
noodle
normal
north
nose
notable
note
nothing
notice
novel
now
nuclear
number
nurse
nut
oak
obey
object
oblige
obscure
observe
obtain
obvious
occur
ocean
october
odor
off
offer
office
often
oil
okay
old
olive
olympic
omit
once
one
onion
online
only
open
opera
opinion
oppose
option
orange
orbit
orchard
order
ordinary
organ
orient
original
orphan
ostrich
other
outdoor
outer
output
outside
oval
oven
over
own
owner
oxygen
oyster
ozone
pact
paddle
page
pair
palace
palm
panda
panel
panic
panther
paper
parade
parent
park
parrot
party
pass
patch
path
patient
patrol
pattern
pause
pave
payment
peace
peanut
pear
peasant
pelican
pen
penalty
pencil
people
pepper
perfect
permit
person
pet
phone
photo
phrase
physical
piano
picnic
picture
piece
pig
pigeon
pill
pilot
pink
pioneer
pipe
pistol
pitch
pizza
place
planet
plastic
plate
play
please
pledge
pluck
plug
plunge
poem
poet
point
polar
pole
police
pond
pony
pool
popular
portion
position
possible
post
potato
pottery
poverty
powder
power
practice
praise
predict
prefer
prepare
present
pretty
prevent
price
pride
primary
print
priority
prison
private
prize
problem
process
produce
profit
program
project
promote
proof
property
prosper
protect
proud
provide
public
pudding
pull
pulp
pulse
pumpkin
punch
pupil
puppy
purchase
purity
purpose
purse
push
put
puzzle
pyramid
quality
quantum
quarter
question
quick
quit
quiz
quote
rabbit
raccoon
race
rack
radar
radio
rail
rain
raise
rally
ramp
ranch
random
range
rapid
rare
rate
rather
raven
raw
razor
ready
real
reason
rebel
rebuild
recall
receive
recipe
record
recycle
reduce
reflect
reform
refuse
region
regret
regular
reject
relax
release
relief
rely
remain
remember
remind
remove
render
renew
rent
reopen
repair
repeat
replace
report
require
rescue
resemble
resist
resource
response
result
retire
retreat
return
reunion
reveal
review
reward
rhythm
rib
ribbon
rice
rich
ride
ridge
rifle
right
rigid
ring
riot
ripple
risk
ritual
rival
river
road
roast
robot
robust
rocket
romance
roof
rookie
room
rose
rotate
rough
round
route
royal
rubber
rude
rug
rule
run
runway
rural
sad
saddle
sadness
safe
sail
salad
salmon
salon
salt
salute
same
sample
sand
satisfy
satoshi
sauce
sausage
save
say
scale
scan
scare
scatter
scene
scheme
school
science
scissors
scorpion
scout
scrap
screen
script
scrub
sea
search
season
seat
second
secret
section
security
seed
seek
segment
select
sell
seminar
senior
sense
sentence
series
service
session
settle
setup
seven
shadow
shaft
shallow
share
shed
shell
sheriff
shield
shift
shine
ship
shiver
shock
shoe
shoot
shop
short
shoulder
shove
shrimp
shrug
shuffle
shy
sibling
sick
side
siege
sight
sign
silent
silk
silly
silver
similar
simple
since
sing
siren
sister
situate
six
size
skate
sketch
ski
skill
skin
skirt
skull
slab
slam
sleep
slender
slice
slide
slight
slim
slogan
slot
slow
slush
small
smart
smile
smoke
smooth
snack
snake
snap
sniff
snow
soap
soccer
social
sock
soda
soft
solar
soldier
solid
solution
solve
someone
song
soon
sorry
sort
soul
sound
soup
source
south
space
spare
spatial
spawn
speak
special
speed
spell
spend
sphere
spice
spider
spike
spin
spirit
split
spoil
sponsor
spoon
sport
spot
spray
spread
spring
spy
square
squeeze
squirrel
stable
stadium
staff
stage
stairs
stamp
stand
start
state
stay
steak
steel
stem
step
stereo
stick
still
sting
stock
stomach
stone
stool
story
stove
strategy
street
strike
strong
struggle
student
stuff
stumble
style
subject
submit
subway
success
such
sudden
suffer
sugar
suggest
suit
summer
sun
sunny
sunset
super
supply
supreme
sure
surface
surge
surprise
surround
survey
suspect
sustain
swallow
swamp
swap
swarm
swear
sweet
swift
swim
swing
switch
sword
symbol
symptom
syrup
system
table
tackle
tag
tail
talent
talk
tank
tape
target
task
taste
tattoo
taxi
teach
team
tell
ten
tenant
tennis
tent
term
test
text
thank
that
theme
then
theory
there
they
thing
this
thought
three
thrive
throw
thumb
thunder
ticket
tide
tiger
tilt
timber
time
tiny
tip
tired
tissue
title
toast
tobacco
today
toddler
toe
together
toilet
token
tomato
tomorrow
tone
tongue
tonight
tool
tooth
top
topic
topple
torch
tornado
tortoise
toss
total
tourist
toward
tower
town
toy
track
trade
traffic
tragic
train
transfer
trap
trash
travel
tray
treat
tree
trend
trial
tribe
trick
trigger
trim
trip
trophy
trouble
truck
true
truly
trumpet
trust
truth
try
tube
tuition
tumble
tuna
tunnel
turkey
turn
turtle
twelve
twenty
twice
twin
twist
two
type
typical
ugly
umbrella
unable
unaware
uncle
uncover
under
undo
unfair
unfold
unhappy
uniform
unique
unit
universe
unknown
unlock
until
unusual
unveil
update
upgrade
uphold
upon
upper
upset
urban
urge
usage
use
used
useful
useless
usual
utility
vacant
vacuum
vague
valid
valley
valve
van
vanish
vapor
various
vast
vault
vehicle
velvet
vendor
venture
venue
verb
verify
version
very
vessel
veteran
viable
vibrant
vicious
victory
video
view
village
vintage
violin
virtual
virus
visa
visit
visual
vital
vivid
vocal
voice
void
volcano
volume
vote
voyage
wage
wagon
wait
walk
wall
walnut
want
warfare
warm
warrior
wash
wasp
waste
water
wave
way
wealth
weapon
wear
weasel
weather
web
wedding
weekend
weird
welcome
west
wet
whale
what
wheat
wheel
when
where
whip
whisper
wide
width
wife
wild
will
win
window
wine
wing
wink
winner
winter
wire
wisdom
wise
wish
witness
wolf
woman
wonder
wood
wool
word
work
world
worry
worth
wrap
wreck
wrestle
wrist
write
wrong
yard
year
yellow
you
young
youth
zebra
zero
zone
zoo`.split(`
`));function Ut(t){return new Promise((e,n)=>{t.onsuccess=()=>e(t.result),t.onerror=()=>n(t.error??new Error("IndexedDB request failed"))})}function Ke(t){return new Promise((e,n)=>{t.oncomplete=()=>e(),t.onerror=()=>n(t.error??new Error("IndexedDB transaction failed")),t.onabort=()=>n(t.error??new Error("IndexedDB transaction aborted"))})}function Ul(t,e,n){return new Promise((r,a)=>{const i=indexedDB.open(t,e);i.onupgradeneeded=()=>n(i.result),i.onsuccess=()=>r(i.result),i.onerror=()=>a(i.error??new Error(`IndexedDB open failed: ${t}`))})}const kr="keys",ms="identity-seed",lp=Qr("any-comments/keystore/v1"),up=Qr("ed25519-identity");function ql(t){if(t.length!==32)throw new Error(`seed must be 32 bytes, got ${t.length}`);return Vh(Ha,t,lp,up,32)}function fp(t){const e=t.trim().toLowerCase().replace(/\s+/g," ");if(!cp(e,Hl))throw new Error("invalid mnemonic (bad word or checksum)");return jl(e,Hl)}class dp{constructor(e="any-comments-keystore"){M(this,ba);M(this,yi);M(this,Hn,null);T(this,yi,e)}async loadSeed(){const n=(await _(this,ba,Ho).call(this)).transaction(kr,"readonly"),r=await Ut(n.objectStore(kr).get(ms));return await Ke(n),r===void 0?null:r instanceof Uint8Array?r:new Uint8Array(r)}async saveSeed(e){if(e.length!==32)throw new Error(`seed must be 32 bytes, got ${e.length}`);const r=(await _(this,ba,Ho).call(this)).transaction(kr,"readwrite");r.objectStore(kr).put(e,ms),await Ke(r)}async deleteSeed(){const n=(await _(this,ba,Ho).call(this)).transaction(kr,"readwrite");n.objectStore(kr).delete(ms),await Ke(n)}async getOrCreateSeed(){const e=await this.loadSeed();if(e)return e;const n=Pi(32);return await this.saveSeed(n),n}async getOrCreateSigner(){return new Zi(ql(await this.getOrCreateSeed()))}async restoreFromMnemonic(e){const n=fp(e);return await this.saveSeed(n),new Zi(ql(n))}close(){var e;(e=u(this,Hn))==null||e.close(),T(this,Hn,null)}}yi=new WeakMap,Hn=new WeakMap,ba=new WeakSet,Ho=async function(){return u(this,Hn)?u(this,Hn):(T(this,Hn,await Ul(u(this,yi),1,e=>{e.createObjectStore(kr)})),u(this,Hn))};const hp=1;class pp{constructor(e="any-comments-store"){M(this,nt);M(this,xi);M(this,Un,null);T(this,xi,e)}async putPage(e,n){const a=(await _(this,nt,ht).call(this)).transaction("pages","readwrite");a.objectStore("pages").put({...n,project:e}),await Ke(a)}async getPage(e,n){const a=(await _(this,nt,ht).call(this)).transaction("pages","readonly"),i=await Ut(a.objectStore("pages").get([e,n]));return await Ke(a),i}async putComments(e,n){if(n.length===0)return;const a=(await _(this,nt,ht).call(this)).transaction("comments","readwrite"),i=a.objectStore("comments");for(const s of n)i.put({...s,project:e});await Ke(a)}async getComment(e,n){const a=(await _(this,nt,ht).call(this)).transaction("comments","readonly"),i=await Ut(a.objectStore("comments").get([e,n]));return await Ke(a),i}async getCommentsByPage(e,n){const a=(await _(this,nt,ht).call(this)).transaction("comments","readonly"),i=await Ut(a.objectStore("comments").index("by_page").getAll([e,n]));return await Ke(a),i.sort((s,o)=>s.created_at-o.created_at||(s.id<o.id?-1:s.id>o.id?1:0))}async deleteComments(e,n){if(n.length===0)return;const a=(await _(this,nt,ht).call(this)).transaction("comments","readwrite"),i=a.objectStore("comments");for(const s of n)i.delete([e,s]);await Ke(a)}async outboxAdd(e,n,r=Date.now()){const i=(await _(this,nt,ht).call(this)).transaction("outbox","readwrite"),s=await Ut(i.objectStore("outbox").add({...n,project:e,client_ts:r}));return await Ke(i),s}async outboxList(e){const r=(await _(this,nt,ht).call(this)).transaction("outbox","readonly"),a=await Ut(r.objectStore("outbox").index("by_project").getAll(e));return await Ke(r),a.sort((i,s)=>i.seq-s.seq)}async outboxRemove(e){const r=(await _(this,nt,ht).call(this)).transaction("outbox","readwrite");r.objectStore("outbox").delete(e),await Ke(r)}async outboxCount(e){const r=(await _(this,nt,ht).call(this)).transaction("outbox","readonly"),a=await Ut(r.objectStore("outbox").index("by_project").count(e));return await Ke(r),a}async kvGet(e,n){const a=(await _(this,nt,ht).call(this)).transaction("kv","readonly"),i=await Ut(a.objectStore("kv").get([e,n]));return await Ke(a),i==null?void 0:i.v}async kvSet(e,n,r){const i=(await _(this,nt,ht).call(this)).transaction("kv","readwrite");i.objectStore("kv").put({project:e,k:n,v:r}),await Ke(i)}async kvDelete(e,n){const a=(await _(this,nt,ht).call(this)).transaction("kv","readwrite");a.objectStore("kv").delete([e,n]),await Ke(a)}async exportAll(){const n=(await _(this,nt,ht).call(this)).transaction(["pages","comments","kv"],"readonly"),[r,a,i]=await Promise.all([Ut(n.objectStore("pages").getAll()),Ut(n.objectStore("comments").getAll()),Ut(n.objectStore("kv").getAll())]);return await Ke(n),{version:1,exported_at:Date.now(),pages:r,comments:a,kv:i}}async importAll(e){if((e==null?void 0:e.version)!==1||!Array.isArray(e.pages)||!Array.isArray(e.comments)||!Array.isArray(e.kv))throw new Error("无法识别的备份文件格式");const r=(await _(this,nt,ht).call(this)).transaction(["pages","comments","kv"],"readwrite"),a=r.objectStore("pages"),i=r.objectStore("comments"),s=r.objectStore("kv");let o=0,l=0;const c=async(f,p,d)=>{if(p===null){l++;return}if(await Ut(f.getKey(p))!==void 0){l++;return}f.put(d),o++};for(const f of e.pages){const p=typeof(f==null?void 0:f.project)=="string"&&typeof(f==null?void 0:f.page_id)=="string"?[f.project,f.page_id]:null;await c(a,p,f)}for(const f of e.comments){const p=typeof(f==null?void 0:f.project)=="string"&&typeof(f==null?void 0:f.id)=="string"?[f.project,f.id]:null;await c(i,p,f)}for(const f of e.kv){const p=typeof(f==null?void 0:f.project)=="string"&&typeof(f==null?void 0:f.k)=="string"?[f.project,f.k]:null;await c(s,p,f)}return await Ke(r),{added:o,skipped:l}}close(){var e;(e=u(this,Un))==null||e.close(),T(this,Un,null)}}xi=new WeakMap,Un=new WeakMap,nt=new WeakSet,ht=async function(){return u(this,Un)?u(this,Un):(T(this,Un,await Ul(u(this,xi),hp,e=>{e.createObjectStore("pages",{keyPath:["project","page_id"]}),e.createObjectStore("comments",{keyPath:["project","id"]}).createIndex("by_page",["project","page_id"]),e.createObjectStore("outbox",{keyPath:"seq",autoIncrement:!0}).createIndex("by_project","project"),e.createObjectStore("kv",{keyPath:["project","k"]})})),u(this,Un))};class $l extends Error{constructor(n,r,a){super(n);k(this,"code");k(this,"status");k(this,"data");this.name="ApiError",this.code=n,this.status=r,this.data=a}get powBits(){var r;const n=(r=this.data)==null?void 0:r.pow_bits;return typeof n=="number"&&Number.isInteger(n)&&n>=0?n:void 0}}class gp{constructor(e){M(this,re);M(this,_i);M(this,fr);M(this,Pe);M(this,ki);var r;T(this,_i,e.apiBase.replace(/\/+$/,"")),T(this,fr,e.apiKey),T(this,Pe,e.projectId);const n=e.fetchFn??((r=globalThis.fetch)==null?void 0:r.bind(globalThis));if(!n)throw new Error("no fetch implementation available");T(this,ki,n)}get projectId(){return u(this,Pe)}async health(){return _(this,re,It).call(this,"GET","/health")}async bootstrap(e,n,r,a){return _(this,re,It).call(this,"GET","/v1/bootstrap",{query:{project:u(this,Pe),page_id:e,curl:n,ctitle:r},headers:_(this,re,Ic).call(this,a)})}async changes(e,n,r){return _(this,re,It).call(this,"GET",`/v1/pages/${encodeURIComponent(e)}/changes`,{query:{project:u(this,Pe),since:n},headers:_(this,re,Ic).call(this,r)})}async postComment(e,n){const r=Date.now(),a=Ht(),i=await _(this,re,en).call(this,e,cs({project:u(this,Pe),id:n.id,pageId:n.page_id,parentId:n.parent_id,contentRaw:n.content_raw,anchor:n.anchor,clientTs:n.client_ts,meta:n.meta??null,ts:r,nonce:a}),r,a);return _(this,re,It).call(this,"POST","/v1/comments",{body:n,headers:_(this,re,Xn).call(this,i)})}async toggleLike(e,n){const r=Date.now(),a=Ht(),i=await _(this,re,en).call(this,e,Cl({project:u(this,Pe),targetType:n.target_type,targetId:n.target_id,action:n.action,ts:r,nonce:a}),r,a);return _(this,re,It).call(this,"POST","/v1/likes/toggle",{body:n,headers:_(this,re,Xn).call(this,i)})}async reportComment(e,n){const r=Date.now(),a=Ht(),i=await _(this,re,en).call(this,e,Il({project:u(this,Pe),commentId:n.comment_id,reason:n.reason,ts:r,nonce:a}),r,a);await _(this,re,It).call(this,"POST","/v1/reports",{body:n,headers:_(this,re,Xn).call(this,i)})}async rescue(e,n){const r=Date.now(),a=Ht(),i=await _(this,re,en).call(this,e,Ch({project:u(this,Pe),commentId:n.comment_id,rescueType:n.rescue_type,ts:r,nonce:a}),r,a);return _(this,re,It).call(this,"POST","/v1/rescues",{body:n,headers:_(this,re,Xn).call(this,i)})}async syncPush(e,n){const r=[];for(const o of n){const l=Date.now(),c=Ht();let f;o.kind==="comment"?f=cs({project:u(this,Pe),id:o.body.id,pageId:o.body.page_id,parentId:o.body.parent_id,contentRaw:o.body.content_raw,anchor:o.body.anchor,clientTs:o.body.client_ts,meta:o.body.meta??null,ts:l,nonce:c}):o.kind==="like"?f=Cl({project:u(this,Pe),targetType:o.body.target_type,targetId:o.body.target_id,action:o.body.action,ts:l,nonce:c}):f=Il({project:u(this,Pe),commentId:o.body.comment_id,reason:o.body.reason,ts:l,nonce:c});const p=await _(this,re,en).call(this,e,f,l,c);r.push({kind:o.kind,body:o.body,sig_headers:p})}const a=Date.now(),i=Ht(),s=await _(this,re,en).call(this,e,kh({project:u(this,Pe),ops:r,ts:a,nonce:i}),a,i);return _(this,re,It).call(this,"POST","/v1/sync/push",{body:{ops:r},headers:_(this,re,Xn).call(this,s)})}async inbox(e,n){const r=Date.now(),a=Ht(),i=await _(this,re,en).call(this,e,Eh({project:u(this,Pe),since:n,ts:r,nonce:a}),r,a);return _(this,re,It).call(this,"GET","/v1/me/inbox",{query:{project:u(this,Pe),since:String(n),..._(this,re,Cc).call(this,i)}})}async setName(e,n){const r=Date.now(),a=Ht(),i=await _(this,re,en).call(this,e,Ah({project:u(this,Pe),name:n,ts:r,nonce:a}),r,a);return _(this,re,It).call(this,"POST","/v1/me/name",{body:{name:n},headers:_(this,re,Xn).call(this,i)})}async adminQueue(e){const n=Date.now(),r=Ht(),a=await _(this,re,en).call(this,e,Sh({project:u(this,Pe),ts:n,nonce:r}),n,r);return _(this,re,It).call(this,"GET","/v1/admin/mod/queue",{query:{project:u(this,Pe),..._(this,re,Cc).call(this,a)}})}async adminDecide(e,n){const r=Date.now(),a=Ht(),i=await _(this,re,en).call(this,e,Th({project:u(this,Pe),commentId:n.comment_id,action:n.action,reason:n.reason,ts:r,nonce:a}),r,a);return _(this,re,It).call(this,"POST","/v1/admin/mod/decide",{body:n,headers:_(this,re,Xn).call(this,i)})}async adminPatchProject(e,n){const r=Date.now(),a=Ht(),i=await _(this,re,en).call(this,e,Rh({project:u(this,Pe),settings:n.settings,ts:r,nonce:a}),r,a);return _(this,re,It).call(this,"PATCH",`/v1/admin/projects/${encodeURIComponent(u(this,Pe))}`,{body:n,headers:_(this,re,Xn).call(this,i)})}}_i=new WeakMap,fr=new WeakMap,Pe=new WeakMap,ki=new WeakMap,re=new WeakSet,It=async function(e,n,r={}){const a=new URL(`${u(this,_i)}${n}`);for(const[l,c]of Object.entries(r.query??{}))a.searchParams.set(l,c);const i={...r.headers};let s;r.body!==void 0&&(i["content-type"]="application/json",s=JSON.stringify(r.body));const o=await u(this,ki).call(this,a.toString(),{method:e,headers:i,...s!==void 0?{body:s}:{}});if(!o.ok){let l=`http_${o.status}`,c;try{const f=await o.json();f&&typeof f.error=="string"&&(l=f.error,c=f)}catch{}throw new $l(l,o.status,c)}if(o.status!==204)return await o.json()},en=async function(e,n,r,a){const i=Hi(await e.sign(Qr(n)));return{pub:Rl(e.publicKey),sig:i,ts:r,nonce:a}},Xn=function(e){return{"X-AC-Key":u(this,fr),"X-AC-Pub":e.pub,"X-AC-Sig":e.sig,"X-AC-TS":String(e.ts),"X-AC-Nonce":e.nonce}},Cc=function(e){return{ac_key:u(this,fr),ac_pub:e.pub,ac_sig:e.sig,ac_ts:String(e.ts),ac_nonce:e.nonce}},Ic=function(e){return e?{"X-AC-Key":u(this,fr),"X-AC-Pub":e}:{"X-AC-Key":u(this,fr)}};const mp=6e4,bp=16,Gl=32;function vp(t){return t===null?null:JSON.parse(JSON.stringify(t))}function wp(t){return t===null?null:JSON.parse(JSON.stringify(t))}function yp(){const t=globalThis.crypto;if(t!=null&&t.randomUUID)return t.randomUUID();const e=Pi(16);e[6]=e[6]&15|64,e[8]=e[8]&63|128;const n=Array.from(e,r=>r.toString(16).padStart(2,"0")).join("");return`${n.slice(0,8)}-${n.slice(8,12)}-${n.slice(12,16)}-${n.slice(16,20)}-${n.slice(20)}`}function xp(t){return t.filter(e=>e.status!=="rejected"&&e.status!=="deleted")}class _p{constructor(e){M(this,P);M(this,Dt);M(this,ee);M(this,va);M(this,St,null);M(this,Mt,null);M(this,Vt,"idle");M(this,wt,"public");M(this,Xt,null);M(this,Fr,[]);M(this,Fe,null);M(this,wa,0);M(this,Ei,null);M(this,Wt);M(this,ya,{status:"idle",mode:"public",page:null,comments:[],me:null,syncing:0,governance:null});M(this,jr,new Set);M(this,ae,"");M(this,Tt,"");M(this,xa,"");M(this,_a,"");M(this,ka,!1);M(this,dr,!1);M(this,Ea,!1);M(this,hr,0);M(this,cn,null);M(this,Sa,new Map);T(this,Dt,e),T(this,ee,e.store??new pp(e.storeDbName)),T(this,va,e.keystore??new dp(e.keystoreDbName))}get state(){return u(this,ya)}subscribe(e){u(this,jr).add(e);try{e(u(this,ya))}catch(n){console.error("[any-comments] engine subscriber error:",n)}return()=>{u(this,jr).delete(e)}}async init(e){var s;if(u(this,dr))throw new Error("engine destroyed");if(u(this,ka))throw new Error("engine already initialized");T(this,ka,!0),T(this,ae,e.projectId),T(this,xa,Ol(e.url,u(this,Dt).extraRules)),T(this,Tt,Nh(e.url,u(this,Dt).extraRules)),T(this,_a,e.title);const n=((s=e.apiBase)==null?void 0:s.trim())??"";T(this,wt,n===""&&!u(this,Dt).api?"private":"public"),u(this,wt)==="public"&&T(this,St,u(this,Dt).api??new gp({apiBase:n,apiKey:e.apiKey,projectId:e.projectId,...u(this,Dt).fetchFn?{fetchFn:u(this,Dt).fetchFn}:{}})),T(this,Vt,"loading"),_(this,P,rt).call(this),T(this,Mt,u(this,Dt).signer??await u(this,va).getOrCreateSigner());const r=Rl(u(this,Mt).publicKey),a=await u(this,ee).kvGet(u(this,ae),"display_name")??null;if(T(this,Fe,{pubkey:r,userIdShort:bh(r),displayName:a,today_comment_bits:0}),_(this,P,rt).call(this),await _(this,P,tn).call(this),u(this,wt)==="private"){if(!u(this,Xt)){const o=Date.now();await u(this,ee).putPage(u(this,ae),{page_id:u(this,Tt),canonical_url:u(this,xa),title:u(this,_a),comment_count:0,like_count:0,liked_by_me:!1,created_at:o,updated_at:o}),await _(this,P,tn).call(this)}T(this,Vt,"ready"),_(this,P,rt).call(this);return}u(this,Xt)&&(T(this,Vt,"ready"),_(this,P,rt).call(this));const i=await u(this,ee).kvGet(u(this,ae),_(this,P,Li).call(this))??"";if(u(this,Xt)&&i!==""){const o=u(this,St);if(o.me)try{const l=await o.me();l&&(!u(this,Fe).displayName&&l.display_name&&await u(this,ee).kvSet(u(this,ae),"display_name",l.display_name),T(this,Fe,{...u(this,Fe),pubkey:l.pubkey,displayName:u(this,Fe).displayName??l.display_name}))}catch{}try{await _(this,P,Lc).call(this),T(this,Wt,void 0)}catch(l){T(this,Wt,l instanceof Error?l.message:String(l))}T(this,Vt,"ready"),await _(this,P,tn).call(this),_(this,P,rt).call(this);return}try{const o=await u(this,St).bootstrap(u(this,Tt),u(this,xa),u(this,_a),r);await _(this,P,sd).call(this,o),T(this,Wt,void 0),T(this,Vt,"ready"),await _(this,P,tn).call(this),_(this,P,rt).call(this)}catch(o){u(this,Xt)?(T(this,Wt,o instanceof Error?o.message:String(o)),T(this,Vt,"ready")):(T(this,Wt,o instanceof Error?o.message:String(o)),T(this,Vt,"error")),_(this,P,rt).call(this)}}async refresh(){if(_(this,P,Vr).call(this),u(this,wt)==="private"){await _(this,P,tn).call(this),_(this,P,rt).call(this);return}await _(this,P,Nc).call(this);try{await _(this,P,Lc).call(this),T(this,Wt,void 0),T(this,Vt,"ready")}catch(e){T(this,Wt,e instanceof Error?e.message:String(e))}await _(this,P,tn).call(this),_(this,P,rt).call(this)}async submitComment(e){_(this,P,Vr).call(this);const n=yp(),r=Date.now(),a=vp(e.anchor??null),i=wp(e.meta??null),s=e.parentId??null;e.optimisticRange&&u(this,Sa).set(n,e.optimisticRange);let o=null;if(s){const g=await u(this,ee).getComment(u(this,ae),s);o=g?g.root_id??g.id:s}const l=Date.now(),c=Ht(),f=cs({project:u(this,ae),id:n,pageId:u(this,Tt),parentId:s,contentRaw:e.content,anchor:a,clientTs:r,meta:i,ts:l,nonce:c}),p=Hi(await u(this,Mt).sign(Qr(f))),d={id:n,page_id:u(this,Tt),parent_id:s,root_id:o,author_pubkey:u(this,Fe).pubkey,display_name:u(this,Fe).displayName,content_raw:e.content,anchor:a,anchor_status:"ok",status:u(this,wt)==="private"?"approved":"pending",like_count:0,liked_by_me:!1,signature:p,client_ts:r,created_at:r,updated_at:r,expires_at:null,meta:i},m={id:n,page_id:u(this,Tt),parent_id:s,content_raw:e.content,anchor:a,anchor_status:"ok",client_ts:r,...i!==null?{meta:i}:{}};return await u(this,ee).putComments(u(this,ae),[d]),u(this,wt)==="private"?(await _(this,P,od).call(this,1),await _(this,P,tn).call(this),_(this,P,rt).call(this),d):(await u(this,ee).outboxAdd(u(this,ae),{kind:"comment",body:m},r),await _(this,P,tn).call(this),_(this,P,rt).call(this),_(this,P,Ni).call(this),d)}async toggleLike(e,n){_(this,P,Vr).call(this);let r;if(e==="comment"){const a=await u(this,ee).getComment(u(this,ae),n);if(!a)throw new Error(`comment not found locally: ${n}`);r=a.liked_by_me,await u(this,ee).putComments(u(this,ae),[{...a,liked_by_me:!r,like_count:Math.max(0,a.like_count+(r?-1:1))}])}else{const a=await u(this,ee).getPage(u(this,ae),n);if(!a)throw new Error(`page not found locally: ${n}`);r=a.liked_by_me,await u(this,ee).putPage(u(this,ae),{...a,liked_by_me:!r,like_count:Math.max(0,a.like_count+(r?-1:1))})}if(u(this,wt)==="public"){const a=(await u(this,ee).outboxList(u(this,ae))).filter(i=>i.kind==="like"&&i.body.target_type===e&&i.body.target_id===n);if(a.length>0)for(const i of a)await u(this,ee).outboxRemove(i.seq);else await u(this,ee).outboxAdd(u(this,ae),{kind:"like",body:{target_type:e,target_id:n,action:r?"unlike":"like"}})}await _(this,P,tn).call(this),_(this,P,rt).call(this),u(this,wt)==="public"&&_(this,P,Ni).call(this)}async report(e,n){_(this,P,Vr).call(this),u(this,wt)!=="private"&&(await u(this,ee).outboxAdd(u(this,ae),{kind:"report",body:{comment_id:e,reason:n}}),await _(this,P,tn).call(this),_(this,P,rt).call(this),_(this,P,Ni).call(this))}async rescue(e,n){if(_(this,P,Vr).call(this),u(this,wt)==="private"||!u(this,St))throw new Error("rescue 不可用：私人模式不连接服务器");const r=n==="self"?20:16,a=await u(this,St).rescue(u(this,Mt),{comment_id:e,rescue_type:n,pow:{solution:await _(this,P,Uo).call(this,e,r)}});return await u(this,ee).putComments(u(this,ae),[a]),await _(this,P,tn).call(this),_(this,P,rt).call(this),a}async setDisplayName(e){if(_(this,P,Vr).call(this),u(this,wt)==="private"){const r=(e==null?void 0:e.trim())??"";r===""?await u(this,ee).kvDelete(u(this,ae),"display_name"):await u(this,ee).kvSet(u(this,ae),"display_name",r),T(this,Fe,{...u(this,Fe),displayName:r===""?null:r}),_(this,P,rt).call(this);return}const n=await u(this,St).setName(u(this,Mt),e??"");n.display_name===null?await u(this,ee).kvDelete(u(this,ae),"display_name"):await u(this,ee).kvSet(u(this,ae),"display_name",n.display_name),T(this,Fe,{...u(this,Fe),displayName:n.display_name}),_(this,P,rt).call(this)}highlightAll(e){const n=u(this,Fr).filter(a=>a.anchor!==null&&a.anchor_status==="ok"),r=n.map(a=>u(this,Sa).get(a.root_id??a.id)??null);qh(e,n.map(a=>a.anchor),{resolved:r})}locateComment(e,n){const r=u(this,Fr).find(o=>o.id===e);if(!r||!r.anchor)return!1;const a=Ll(n,r.anchor);if(!a)return!1;const i=a.startContainer,s=i.nodeType===1?i:i.parentElement;return s==null||s.scrollIntoView({block:"center"}),!0}destroy(){T(this,dr,!0),u(this,cn)!==null&&(clearTimeout(u(this,cn)),T(this,cn,null)),u(this,jr).clear(),u(this,Sa).clear(),u(this,ee).close(),u(this,va).close()}}Dt=new WeakMap,ee=new WeakMap,va=new WeakMap,St=new WeakMap,Mt=new WeakMap,Vt=new WeakMap,wt=new WeakMap,Xt=new WeakMap,Fr=new WeakMap,Fe=new WeakMap,wa=new WeakMap,Ei=new WeakMap,Wt=new WeakMap,ya=new WeakMap,jr=new WeakMap,ae=new WeakMap,Tt=new WeakMap,xa=new WeakMap,_a=new WeakMap,ka=new WeakMap,dr=new WeakMap,Ea=new WeakMap,hr=new WeakMap,cn=new WeakMap,Sa=new WeakMap,P=new WeakSet,Uo=function(e,n){return(u(this,Dt).powSolver??xh)(e,n)},rt=function(){const e={status:u(this,Vt),mode:u(this,wt),page:u(this,Xt),comments:u(this,Fr),me:u(this,Fe),syncing:u(this,wa),governance:u(this,Ei),...u(this,Wt)!==void 0?{error:u(this,Wt)}:{}};T(this,ya,e);for(const n of[...u(this,jr)])try{n(e)}catch(r){console.error("[any-comments] engine subscriber error:",r)}},Vr=function(){if(u(this,dr))throw new Error("engine destroyed");if(!u(this,ka)||!u(this,Mt)||!u(this,Fe))throw new Error("engine not initialized")},od=async function(e){const n=await u(this,ee).getPage(u(this,ae),u(this,Tt));n&&await u(this,ee).putPage(u(this,ae),{...n,comment_count:Math.max(0,n.comment_count+e),updated_at:Date.now()})},Li=function(){return`cursor:${u(this,Tt)}`},tn=async function(){T(this,Xt,await u(this,ee).getPage(u(this,ae),u(this,Tt))??null),T(this,Fr,xp(await u(this,ee).getCommentsByPage(u(this,ae),u(this,Tt)))),T(this,wa,await u(this,ee).outboxCount(u(this,ae)))},Oc=async function(e){const n=await u(this,ee).outboxList(u(this,ae)),r=new Set(n.filter(a=>a.kind==="like").map(a=>a.body.target_id));return r.size===0?e:Promise.all(e.map(async a=>{if(!r.has(a.id))return a;const i=await u(this,ee).getComment(u(this,ae),a.id);return i?{...a,liked_by_me:i.liked_by_me,like_count:i.like_count}:a}))},Lc=async function(){const e=await u(this,ee).kvGet(u(this,ae),_(this,P,Li).call(this))??"",n=await u(this,St).changes(u(this,Tt),e,u(this,Fe).pubkey);await u(this,ee).deleteComments(u(this,ae),n.deletes),await u(this,ee).putComments(u(this,ae),await _(this,P,Oc).call(this,n.upserts)),await u(this,ee).kvSet(u(this,ae),_(this,P,Li).call(this),n.cursor)},sd=async function(e){var i;const n=await u(this,ee).outboxList(u(this,ae)),r=new Set(n.filter(s=>s.kind==="like").map(s=>s.body.target_id));let a=e.page;r.has(a.page_id)&&u(this,Xt)&&(a={...a,liked_by_me:u(this,Xt).liked_by_me,like_count:u(this,Xt).like_count}),await u(this,ee).putPage(u(this,ae),a),await u(this,ee).putComments(u(this,ae),await _(this,P,Oc).call(this,e.comments)),await u(this,ee).kvSet(u(this,ae),_(this,P,Li).call(this),e.cursor),T(this,Ei,e.governance),e.me&&T(this,Fe,{...u(this,Fe),pubkey:e.me.pubkey,today_comment_bits:e.me.today_comment_bits}),!u(this,Fe).displayName&&((i=e.me)!=null&&i.display_name)&&(await u(this,ee).kvSet(u(this,ae),"display_name",e.me.display_name),T(this,Fe,{...u(this,Fe),displayName:e.me.display_name}))},Ni=function(){_(this,P,Nc).call(this).catch(()=>{})},Nc=async function(){if(!(u(this,Ea)||u(this,dr)||!u(this,St)||!u(this,Mt))){T(this,Ea,!0);try{const e=await u(this,ee).outboxList(u(this,ae));if(e.length===0){T(this,hr,0);return}const n=[...e].sort((r,a)=>r.client_ts-a.client_ts||r.seq-a.seq);try{const r=await _(this,P,cd).call(this,n.map(i=>({kind:i.kind,body:i.body})));let a=!0;for(let i=0;i<n.length;i++){const s=r.results[i];s&&s.ok?await u(this,ee).outboxRemove(n[i].seq):a=!1}T(this,wa,await u(this,ee).outboxCount(u(this,ae))),_(this,P,rt).call(this),a?T(this,hr,0):_(this,P,Dc).call(this)}catch{_(this,P,Dc).call(this)}}finally{T(this,Ea,!1)}}},cd=async function(e){let n;try{n=await u(this,St).syncPush(u(this,Mt),e)}catch(s){if(!(s instanceof $l)||s.code!=="pow_required")throw s;const o=s.powBits;if(o===void 0||o>Gl||!e.some(c=>c.kind==="comment"))throw s;const l=await Promise.all(e.map(async c=>c.kind!=="comment"?c:{kind:"comment",body:{...c.body,pow:{solution:await _(this,P,Uo).call(this,c.body.id,o)}}}));return await u(this,St).syncPush(u(this,Mt),l)}const r=[];for(let s=0;s<e.length;s++){const o=e[s],l=n.results[s];if(o.kind!=="comment"||!l||l.ok||l.error!=="pow_required")continue;const c=l.pow_bits;typeof c!="number"||!Number.isInteger(c)||c<0||c>Gl||r.push({index:s,op:{kind:"comment",body:{...o.body,pow:{solution:await _(this,P,Uo).call(this,o.body.id,c)}}}})}if(r.length===0)return n;let a;try{a=await u(this,St).syncPush(u(this,Mt),r.map(s=>s.op))}catch{return n}const i={results:[...n.results]};for(let s=0;s<r.length;s++){const o=a.results[s];o&&(i.results[r[s].index]=o)}return i},Dc=function(){var a;if(u(this,dr))return;u(this,hr)<bp&&id(this,hr)._++;const e=u(this,Dt).retryBaseMs??1e3,n=Math.min(e*2**(u(this,hr)-1),mp);u(this,cn)!==null&&clearTimeout(u(this,cn)),T(this,cn,setTimeout(()=>{T(this,cn,null),_(this,P,Ni).call(this)},n));const r=u(this,cn);(a=r.unref)==null||a.call(r)};function kp(t={}){return new _p(t)}const Yl=!1;var Zl=Array.isArray,Ep=Array.prototype.indexOf,ro=Array.prototype.includes,ao=Array.from,Sp=Object.defineProperty,ta=Object.getOwnPropertyDescriptor,Tp=Object.getOwnPropertyDescriptors,Ap=Object.prototype,Rp=Array.prototype,Vl=Object.getPrototypeOf,Xl=Object.isExtensible;const Cp=()=>{};function Ip(t){for(var e=0;e<t.length;e++)t[e]()}function Wl(){var t,e,n=new Promise((r,a)=>{t=r,e=a});return{promise:n,resolve:t,reject:e}}const Qe=2,na=4,io=8,Kl=1<<24,rn=16,qt=32,On=64,bs=128,$t=512,Ye=1024,Ze=2048,an=4096,gt=8192,Ot=16384,ra=32768,vs=1<<25,aa=65536,oo=1<<17,Op=1<<18,ia=1<<19,Lp=1<<20,vn=1<<25,Er=65536,so=1<<21,oa=1<<22,nr=1<<23,Ya=Symbol("$state"),Np=Symbol("legacy props"),Dp=Symbol(""),co=Symbol("attributes"),ws=Symbol("class"),ys=Symbol("style"),Za=Symbol("text"),lo=Symbol("form reset"),Va=new class extends Error{constructor(){super(...arguments);k(this,"name","StaleReactionError");k(this,"message","The reaction that called `getAbortSignal()` was re-run or destroyed")}};function Mp(){throw new Error("https://svelte.dev/e/async_derived_orphan")}function Bp(t,e,n){throw new Error("https://svelte.dev/e/each_key_duplicate")}function Pp(t){throw new Error("https://svelte.dev/e/effect_in_teardown")}function zp(){throw new Error("https://svelte.dev/e/effect_in_unowned_derived")}function Fp(t){throw new Error("https://svelte.dev/e/effect_orphan")}function jp(){throw new Error("https://svelte.dev/e/effect_update_depth_exceeded")}function Hp(t){throw new Error("https://svelte.dev/e/props_invalid_value")}function Up(){throw new Error("https://svelte.dev/e/state_descriptors_fixed")}function qp(){throw new Error("https://svelte.dev/e/state_prototype_fixed")}function $p(){throw new Error("https://svelte.dev/e/state_unsafe_mutation")}function Gp(){throw new Error("https://svelte.dev/e/svelte_boundary_reset_onerror")}const Yp=1,Zp=2,Ql=4,Vp=8,Xp=16,Wp=1,Kp=4,Qp=8,Jp=16,eg=1,tg=2,Ve=Symbol("uninitialized"),Jl="http://www.w3.org/1999/xhtml",ng="http://www.w3.org/2000/svg",rg="http://www.w3.org/1998/Math/MathML";function ag(){console.warn("https://svelte.dev/e/derived_inert")}function ig(){console.warn("https://svelte.dev/e/svelte_boundary_reset_noop")}function eu(t){return t===this.v}function og(t,e){return t!=t?e==e:t!==e||t!==null&&typeof t=="object"||typeof t=="function"}function tu(t){return!og(t,this.v)}let sg=!1,mt=null;function sa(t){mt=t}function Ln(t,e=!1,n){mt={p:mt,i:!1,c:null,e:null,s:t,x:null,r:ue,l:null}}function Nn(t){var e=mt,n=e.e;if(n!==null){e.e=null;for(var r of n)Su(r)}return e.i=!0,mt=e.p,{}}function nu(){return!0}let Sr=[];function ru(){var t=Sr;Sr=[],Ip(t)}function Tr(t){if(Sr.length===0&&!Ja){var e=Sr;queueMicrotask(()=>{e===Sr&&ru()})}Sr.push(t)}function cg(){for(;Sr.length>0;)ru()}function au(t){var e=ue;if(e===null)return le.f|=nr,t;if((e.f&ra)===0&&(e.f&na)===0)throw t;rr(t,e)}function rr(t,e){if(!(e!==null&&(e.f&Ot)!==0)){for(;e!==null;){if((e.f&bs)!==0){if((e.f&ra)===0)throw t;try{e.b.error(t);return}catch(n){t=n}}e=e.parent}throw t}}const lg=-7169;function qe(t,e){t.f=t.f&lg|e}function xs(t){(t.f&$t)!==0||t.deps===null?qe(t,Ye):qe(t,an)}function iu(t){if(t!==null)for(const e of t)(e.f&Qe)===0||(e.f&Er)===0||(e.f^=Er,iu(e.deps))}function ou(t,e,n){(t.f&Ze)!==0?e.add(t):(t.f&an)!==0&&n.add(t),iu(t.deps),qe(t,Ye)}let uo=!1;function ug(t){var e=uo;try{return uo=!1,[t(),uo]}finally{uo=e}}let su=!1;function fg(){su||(su=!0,document.addEventListener("reset",t=>{Promise.resolve().then(()=>{var e;if(!t.defaultPrevented)for(const n of t.target.elements)(e=n[lo])==null||e.call(n)})},{capture:!0}))}function Xa(t){var e=le,n=ue;Yt(null),wn(null);try{return t()}finally{Yt(e),wn(n)}}function dg(t,e,n,r=n){t.addEventListener(e,()=>Xa(n));const a=t[lo];a?t[lo]=()=>{a(),r(!0)}:t[lo]=()=>r(!0),fg()}function hg(t){let e=0,n=Cr(0),r;return()=>{Rs()&&(b(n),Cs(()=>(e===0&&(r=ii(()=>t(()=>ei(n)))),e+=1,()=>{Tr(()=>{e-=1,e===0&&(r==null||r(),r=void 0,ei(n))})})))}}var pg=aa|ia;function gg(t,e,n,r){new mg(t,e,n,r)}class mg{constructor(e,n,r,a){M(this,je);k(this,"parent");k(this,"is_pending",!1);k(this,"transform_error");M(this,Kt);M(this,pc,null);M(this,Qt);M(this,Hr);M(this,At);M(this,Jt,null);M(this,yt,null);M(this,Bt,null);M(this,qn,null);M(this,Ur,0);M(this,pr,0);M(this,Ta,!1);M(this,Si,new Set);M(this,Ti,new Set);M(this,$n,null);M(this,Io,hg(()=>(T(this,$n,Cr(u(this,Ur))),()=>{T(this,$n,null)})));var i;T(this,Kt,e),T(this,Qt,n),T(this,Hr,s=>{var o=ue;o.b=this,o.f|=bs,r(s)}),this.parent=ue.b,this.transform_error=a??((i=this.parent)==null?void 0:i.transform_error)??(s=>s),T(this,At,Is(()=>{_(this,je,Mc).call(this)},pg))}defer_effect(e){ou(e,u(this,Si),u(this,Ti))}is_rendered(){return!this.is_pending&&(!this.parent||this.parent.is_rendered())}has_pending_snippet(){return!!u(this,Qt).pending}update_pending_count(e,n){_(this,je,Bc).call(this,e,n),T(this,Ur,u(this,Ur)+e),!(!u(this,$n)||u(this,Ta))&&(T(this,Ta,!0),Tr(()=>{T(this,Ta,!1),u(this,$n)&&ua(u(this,$n),u(this,Ur))}))}get_effect_pending(){return u(this,Io).call(this),b(u(this,$n))}error(e){if(!u(this,Qt).onerror&&!u(this,Qt).failed)throw e;X!=null&&X.is_fork?(u(this,Jt)&&X.skip_effect(u(this,Jt)),u(this,yt)&&X.skip_effect(u(this,yt)),u(this,Bt)&&X.skip_effect(u(this,Bt)),X.oncommit(()=>{_(this,je,Pc).call(this,e)})):_(this,je,Pc).call(this,e)}}Kt=new WeakMap,pc=new WeakMap,Qt=new WeakMap,Hr=new WeakMap,At=new WeakMap,Jt=new WeakMap,yt=new WeakMap,Bt=new WeakMap,qn=new WeakMap,Ur=new WeakMap,pr=new WeakMap,Ta=new WeakMap,Si=new WeakMap,Ti=new WeakMap,$n=new WeakMap,Io=new WeakMap,je=new WeakSet,Kv=function(){try{T(this,Jt,Gt(()=>u(this,Hr).call(this,u(this,Kt))))}catch(e){this.error(e)}},Qv=function(e){const n=u(this,Qt).failed;n&&T(this,Bt,Gt(()=>{n(u(this,Kt),()=>e,()=>()=>{})}))},Jv=function(){const e=u(this,Qt).pending;e&&(this.is_pending=!0,T(this,yt,Gt(()=>e(u(this,Kt)))),Tr(()=>{var n=T(this,qn,document.createDocumentFragment()),r=Dn();n.append(r),T(this,Jt,_(this,je,$o).call(this,()=>Gt(()=>u(this,Hr).call(this,r)))),u(this,pr)===0&&(u(this,Kt).before(n),T(this,qn,null),Ir(u(this,yt),()=>{T(this,yt,null)}),_(this,je,qo).call(this,X))}))},Mc=function(){try{if(this.is_pending=this.has_pending_snippet(),T(this,pr,0),T(this,Ur,0),T(this,Jt,Gt(()=>{u(this,Hr).call(this,u(this,Kt))})),u(this,pr)>0){var e=T(this,qn,document.createDocumentFragment());Ls(u(this,Jt),e);const n=u(this,Qt).pending;T(this,yt,Gt(()=>n(u(this,Kt))))}else _(this,je,qo).call(this,X)}catch(n){this.error(n)}},qo=function(e){this.is_pending=!1,e.transfer_effects(u(this,Si),u(this,Ti))},$o=function(e){var n=ue,r=le,a=mt;wn(u(this,At)),Yt(u(this,At)),sa(u(this,At).ctx);try{return Ar.ensure(),e()}catch(i){return au(i),null}finally{wn(n),Yt(r),sa(a)}},Bc=function(e,n){var r;if(!this.has_pending_snippet()){this.parent&&_(r=this.parent,je,Bc).call(r,e,n);return}T(this,pr,u(this,pr)+e),u(this,pr)===0&&(_(this,je,qo).call(this,n),u(this,yt)&&Ir(u(this,yt),()=>{T(this,yt,null)}),u(this,qn)&&(u(this,Kt).before(u(this,qn)),T(this,qn,null)))},Pc=function(e){u(this,Jt)&&(_t(u(this,Jt)),T(this,Jt,null)),u(this,yt)&&(_t(u(this,yt)),T(this,yt,null)),u(this,Bt)&&(_t(u(this,Bt)),T(this,Bt,null));var n=u(this,Qt).onerror;let r=u(this,Qt).failed;var a=!1,i=!1;const s=()=>{if(a){ig();return}a=!0,i&&Gp(),u(this,Bt)!==null&&Ir(u(this,Bt),()=>{T(this,Bt,null)}),_(this,je,$o).call(this,()=>{_(this,je,Mc).call(this)})},o=l=>{try{i=!0,n==null||n(l,s),i=!1}catch(c){rr(c,u(this,At)&&u(this,At).parent)}r&&T(this,Bt,_(this,je,$o).call(this,()=>{try{return Gt(()=>{var c=ue;c.b=this,c.f|=bs,r(u(this,Kt),()=>l,()=>s)})}catch(c){return rr(c,u(this,At).parent),null}}))};Tr(()=>{var l;try{l=this.transform_error(e)}catch(c){rr(c,u(this,At)&&u(this,At).parent);return}l!==null&&typeof l=="object"&&typeof l.then=="function"?l.then(o,c=>rr(c,u(this,At)&&u(this,At).parent)):o(l)})};function bg(t,e,n,r){const a=Wa;var i=t.filter(m=>!m.settled),s=e.map(a);if(n.length===0&&i.length===0){r(s);return}var o=ue,l=vg(),c=i.length===1?i[0].promise:i.length>1?Promise.all(i.map(m=>m.promise)):null;function f(m){if((o.f&Ot)===0){l();try{r([...s,...m])}catch(g){rr(g,o)}fo()}}var p=cu();if(n.length===0){c.then(()=>f([])).finally(p);return}function d(){Promise.all(n.map(m=>wg(m))).then(f).catch(m=>rr(m,o)).finally(p)}c?c.then(()=>{l(),d(),fo()}):d()}function vg(){var t=ue,e=le,n=mt,r=X;return function(i=!0){wn(t),Yt(e),sa(n),i&&(t.f&Ot)===0&&(r==null||r.activate(),r==null||r.apply())}}function fo(t=!0){wn(null),Yt(null),sa(null),t&&(X==null||X.deactivate())}function cu(){var t=ue,e=t.b,n=X,r=!!(e!=null&&e.is_rendered());return e==null||e.update_pending_count(1,n),n.increment(r,t),()=>{e==null||e.update_pending_count(-1,n),n.decrement(r,t)}}function Wa(t){var e=Qe|Ze;return ue!==null&&(ue.f|=ia),{ctx:mt,deps:null,effects:null,equals:eu,f:e,fn:t,reactions:null,rv:0,v:Ve,wv:0,parent:ue,ac:null}}const Ka=Symbol("obsolete");function wg(t,e,n){let r=ue;r===null&&Mp();var a=void 0,i=Cr(Ve),s=!le,o=new Set;return Ng(()=>{var m,g;var l=ue,c=Wl();a=c.promise;try{Promise.resolve(t()).then(c.resolve,v=>{v!==Va&&c.reject(v)}).finally(fo)}catch(v){c.reject(v),fo()}var f=X;if(s){if((l.f&ra)!==0)var p=cu();if((m=r.b)!=null&&m.is_rendered())(g=f.async_deriveds.get(l))==null||g.reject(Ka);else for(const v of o.values())v.reject(Ka);o.add(c),f.async_deriveds.set(l,c)}const d=(v,w=void 0)=>{p==null||p(),o.delete(c),w!==Ka&&(f.activate(),w?(i.f|=nr,ua(i,w)):((i.f&nr)!==0&&(i.f^=nr),ua(i,v)),f.deactivate())};c.promise.then(d,v=>d(null,v||"unknown"))}),Og(()=>{for(const l of o)l.reject(Ka)}),new Promise(l=>{function c(f){function p(){f===a?l(i):c(a)}f.then(p,p)}c(a)})}function ye(t){const e=Wa(t);return Nu(e),e}function lu(t){const e=Wa(t);return e.equals=tu,e}function yg(t){var e=t.effects;if(e!==null){t.effects=null;for(var n=0;n<e.length;n+=1)_t(e[n])}}function _s(t){var e,n=ue,r=t.parent;if(!Pn&&r!==null&&t.v!==Ve&&(r.f&(Ot|gt))!==0)return ag(),t.v;wn(r);try{t.f&=~Er,yg(t),e=zu(t)}finally{wn(n)}return e}function uu(t){var e=_s(t);if(!t.equals(e)&&(t.wv=Bu(),(!(X!=null&&X.is_fork)||t.deps===null)&&(X!==null?(X.capture(t,e,!0),Qa==null||Qa.capture(t,e,!0)):t.v=e,t.deps===null))){qe(t,Ye);return}Pn||(it!==null?(Rs()||X!=null&&X.is_fork)&&it.set(t,e):xs(t))}function xg(t){var e;if(t.effects!==null)for(const n of t.effects)(n.teardown||n.ac)&&((e=n.teardown)==null||e.call(n),n.ac!==null&&Xa(()=>{n.ac.abort(Va),n.ac=null}),n.fn!==null&&(n.teardown=Cp),ai(n,0),Os(n))}function fu(t){if(t.effects!==null)for(const e of t.effects)e.teardown&&e.fn!==null&&fa(e)}let ks=null,ca=null,X=null,Qa=null,it=null,Es=null,Ja=!1,Ss=!1,la=null,ho=null;var du=0,o0=new Set;let _g=1;const Oo=class Oo{constructor(){M(this,Re);k(this,"id",_g++);M(this,Aa,!1);k(this,"linked",!0);M(this,gr,null);M(this,qr,null);k(this,"async_deriveds",new Map);k(this,"current",new Map);k(this,"previous",new Map);M(this,Ra,new Set);M(this,Ca,new Set);M(this,Ia,0);M(this,Gn,new Map);M(this,Oa,null);M(this,Rt,[]);M(this,Ai,[]);M(this,Yn,new Set);M(this,ln,new Set);M(this,kn,new Map);M(this,La,new Set);k(this,"is_fork",!1);M(this,$r,!1);ca===null?ks=ca=this:(T(ca,qr,this),T(this,gr,ca)),ca=this}skip_effect(e){u(this,kn).has(e)||u(this,kn).set(e,{d:[],m:[]}),u(this,La).delete(e)}unskip_effect(e,n=r=>this.schedule(r)){var r=u(this,kn).get(e);if(r){u(this,kn).delete(e);for(var a of r.d)qe(a,Ze),n(a);for(a of r.m)qe(a,an),n(a)}u(this,La).add(e)}capture(e,n,r=!1){e.v!==Ve&&!this.previous.has(e)&&this.previous.set(e,e.v),(e.f&nr)===0&&(this.current.set(e,[n,r]),it==null||it.set(e,n)),this.is_fork||(e.v=n)}activate(){X=this}deactivate(){X=null,it=null}flush(){try{Ss=!0,X=this,_(this,Re,Di).call(this)}finally{du=0,Es=null,la=null,ho=null,Ss=!1,X=null,it=null,Rr.clear()}}discard(){var e;for(const n of u(this,Ca))n(this);u(this,Ca).clear();for(const n of this.async_deriveds.values())n.reject(Ka);_(this,Re,Mi).call(this),(e=u(this,Oa))==null||e.resolve()}register_created_effect(e){u(this,Ai).push(e)}increment(e,n){if(T(this,Ia,u(this,Ia)+1),e){let r=u(this,Gn).get(n)??0;u(this,Gn).set(n,r+1)}}decrement(e,n){if(T(this,Ia,u(this,Ia)-1),e){let r=u(this,Gn).get(n)??0;r===1?u(this,Gn).delete(n):u(this,Gn).set(n,r-1)}u(this,$r)||(T(this,$r,!0),Tr(()=>{T(this,$r,!1),this.linked&&this.flush()}))}transfer_effects(e,n){for(const r of e)u(this,Yn).add(r);for(const r of n)u(this,ln).add(r);e.clear(),n.clear()}oncommit(e){u(this,Ra).add(e)}ondiscard(e){u(this,Ca).add(e)}settled(){return(u(this,Oa)??T(this,Oa,Wl())).promise}static ensure(){if(X===null){const e=X=new Oo;!Ss&&!Ja&&Tr(()=>{u(e,Aa)||e.flush()})}return X}apply(){{it=null;return}}schedule(e){var a;if(Es=e,(a=e.b)!=null&&a.is_pending&&(e.f&(na|io|Kl))!==0&&(e.f&ra)===0){e.b.defer_effect(e);return}for(var n=e;n.parent!==null;){n=n.parent;var r=n.f;if(la!==null&&n===ue&&(le===null||(le.f&Qe)===0))return;if((r&(On|qt))!==0){if((r&Ye)===0)return;n.f^=Ye}}u(this,Rt).push(n)}};Aa=new WeakMap,gr=new WeakMap,qr=new WeakMap,Ra=new WeakMap,Ca=new WeakMap,Ia=new WeakMap,Gn=new WeakMap,Oa=new WeakMap,Rt=new WeakMap,Ai=new WeakMap,Yn=new WeakMap,ln=new WeakMap,kn=new WeakMap,La=new WeakMap,$r=new WeakMap,Re=new WeakSet,zc=function(){if(this.is_fork)return!0;for(const r of u(this,Gn).keys()){for(var e=r,n=!1;e.parent!==null;){if(u(this,kn).has(e)){n=!0;break}e=e.parent}if(!n)return!0}return!1},Di=function(){var l,c,f,p;T(this,Aa,!0),du++>1e3&&(_(this,Re,Mi).call(this),Eg());for(const d of u(this,Yn))u(this,ln).delete(d),qe(d,Ze),this.schedule(d);for(const d of u(this,ln))qe(d,an),this.schedule(d);const e=u(this,Rt);T(this,Rt,[]),this.apply();var n=la=[],r=[],a=ho=[];for(const d of e)try{_(this,Re,Fc).call(this,d,n,r)}catch(m){throw mu(d),_(this,Re,zc).call(this)||this.discard(),m}if(X=null,a.length>0){var i=Oo.ensure();for(const d of a)i.schedule(d)}if(la=null,ho=null,_(this,Re,zc).call(this)){_(this,Re,ja).call(this,r),_(this,Re,ja).call(this,n);for(const[d,m]of u(this,kn))gu(d,m);a.length>0&&_(l=X,Re,Di).call(l);return}const s=_(this,Re,ld).call(this);if(s){_(this,Re,ja).call(this,r),_(this,Re,ja).call(this,n),_(c=s,Re,ud).call(c,this);return}u(this,Yn).clear(),u(this,ln).clear();for(const d of u(this,Ra))d(this);u(this,Ra).clear(),Qa=this,hu(r),hu(n),Qa=null,(f=u(this,Oa))==null||f.resolve();var o=X;if(u(this,Ia)===0&&(u(this,Rt).length===0||o!==null)&&_(this,Re,Mi).call(this),u(this,Rt).length>0)if(o!==null){const d=o;u(d,Rt).push(...u(this,Rt).filter(m=>!u(d,Rt).includes(m)))}else o=this;o!==null&&_(p=o,Re,Di).call(p)},Fc=function(e,n,r){e.f^=Ye;for(var a=e.first;a!==null;){var i=a.f,s=(i&(qt|On))!==0,o=s&&(i&Ye)!==0,l=o||(i&gt)!==0||u(this,kn).has(a);if(!l&&a.fn!==null){s?a.f^=Ye:(i&na)!==0?n.push(a):ri(a)&&((i&rn)!==0&&u(this,ln).add(a),fa(a));var c=a.first;if(c!==null){a=c;continue}}for(;a!==null;){var f=a.next;if(f!==null){a=f;break}a=a.parent}}},ld=function(){for(var e=u(this,gr);e!==null;){if(!e.is_fork){for(const[n,[,r]]of this.current)if(e.current.has(n)&&!r)return e}e=u(e,gr)}return null},ud=function(e){var r;for(const[a,i]of e.current)!this.previous.has(a)&&e.previous.has(a)&&this.previous.set(a,e.previous.get(a)),this.current.set(a,i);for(const[a,i]of e.async_deriveds){const s=this.async_deriveds.get(a);s&&i.promise.then(s.resolve).catch(s.reject)}e.async_deriveds.clear(),this.transfer_effects(u(e,Yn),u(e,ln));const n=a=>{var i=a.reactions;if(i!==null&&!((a.f&Qe)!==0&&(a.f&(Ze|an))===0))for(const l of i){var s=l.f;if((s&Qe)!==0)n(l);else{var o=l;s&(oa|rn)&&!this.async_deriveds.has(o)&&(u(this,ln).delete(o),qe(o,Ze),this.schedule(o))}}};for(const a of this.current.keys())n(a);this.oncommit(()=>e.discard()),_(r=e,Re,Mi).call(r),X=this,_(this,Re,Di).call(this)},ja=function(e){for(var n=0;n<e.length;n+=1)ou(e[n],u(this,Yn),u(this,ln))},e0=function(){var p;for(let d=ks;d!==null;d=u(d,qr)){var e=d.id<this.id,n=[];for(const[m,[g,v]]of this.current){if(d.current.has(m)){var r=d.current.get(m)[0];if(e&&g!==r)d.current.set(m,[g,v]);else continue}n.push(m)}if(e)for(const[m,g]of this.async_deriveds){const v=d.async_deriveds.get(m);v&&g.promise.then(v.resolve).catch(v.reject)}var a=[...d.current.keys()].filter(m=>!d.current.get(m)[1]);if(!(!u(d,Aa)||a.length===0)){var i=a.filter(m=>!this.current.has(m));if(i.length===0)e&&d.discard();else if(n.length>0){if(e)for(const m of u(this,La))d.unskip_effect(m,g=>{var v;(g.f&(rn|oa))!==0?d.schedule(g):_(v=d,Re,ja).call(v,[g])});d.activate();var s=new Set,o=new Map;for(var l of n)pu(l,i,s,o);o=new Map;var c=[...d.current].filter(([m,g])=>{const v=this.current.get(m);return v?v[0]!==g[0]||v[1]!==g[1]:!0}).map(([m])=>m);if(c.length>0)for(const m of u(this,Ai))(m.f&(Ot|gt|oo))===0&&Ts(m,c,o)&&((m.f&(oa|rn))!==0?(qe(m,Ze),d.schedule(m)):u(d,Yn).add(m));if(u(d,Rt).length>0&&!u(d,$r)){d.apply();for(var f of u(d,Rt))_(p=d,Re,Fc).call(p,f,[],[]);T(d,Rt,[])}d.deactivate()}}}},Mi=function(){if(this.linked){var e=u(this,gr),n=u(this,qr);e===null?ks=n:T(e,qr,n),n===null?ca=e:T(n,gr,e),this.linked=!1}};let Ar=Oo;function kg(t){var e=Ja;Ja=!0;try{for(var n;;){if(cg(),X===null)return n;X.flush()}}finally{Ja=e}}function Eg(){try{jp()}catch(t){rr(t,Es)}}let on=null;function hu(t){var e=t.length;if(e!==0){for(var n=0;n<e;){var r=t[n++];if((r.f&(Ot|gt))===0&&ri(r)&&(on=new Set,fa(r),r.deps===null&&r.first===null&&r.nodes===null&&r.teardown===null&&r.ac===null&&Cu(r),(on==null?void 0:on.size)>0)){Rr.clear();for(const a of on){if((a.f&(Ot|gt))!==0)continue;const i=[a];let s=a.parent;for(;s!==null;)on.has(s)&&(on.delete(s),i.push(s)),s=s.parent;for(let o=i.length-1;o>=0;o--){const l=i[o];(l.f&(Ot|gt))===0&&fa(l)}}on.clear()}}on=null}}function pu(t,e,n,r){if(!n.has(t)&&(n.add(t),t.reactions!==null))for(const a of t.reactions){const i=a.f;(i&Qe)!==0?pu(a,e,n,r):(i&(oa|rn))!==0&&(i&Ze)===0&&Ts(a,e,r)&&(qe(a,Ze),As(a))}}function Ts(t,e,n){const r=n.get(t);if(r!==void 0)return r;if(t.deps!==null)for(const a of t.deps){if(ro.call(e,a))return!0;if((a.f&Qe)!==0&&Ts(a,e,n))return n.set(a,!0),!0}return n.set(t,!1),!1}function As(t){X.schedule(t)}function gu(t,e){if(!((t.f&qt)!==0&&(t.f&Ye)!==0)){(t.f&Ze)!==0?e.d.push(t):(t.f&an)!==0&&e.m.push(t),qe(t,Ye);for(var n=t.first;n!==null;)gu(n,e),n=n.next}}function mu(t){qe(t,Ye);for(var e=t.first;e!==null;)mu(e),e=e.next}let po=new Set;const Rr=new Map;let bu=!1;function Cr(t,e){var n={f:0,v:t,reactions:null,equals:eu,rv:0,wv:0};return n}function xe(t,e){const n=Cr(t);return Nu(n),n}function Sg(t,e=!1,n=!0){const r=Cr(t);return e||(r.equals=tu),r}function j(t,e,n=!1){le!==null&&(!sn||(le.f&oo)!==0)&&nu()&&(le.f&(Qe|rn|oa|oo))!==0&&(yn===null||!yn.has(t))&&$p();let r=n?ar(e):e;return ua(t,r,ho)}function ua(t,e,n=null){if(!t.equals(e)){Rr.set(t,Pn?e:t.v);var r=Ar.ensure();if(r.capture(t,e),(t.f&Qe)!==0){const a=t;(t.f&Ze)!==0&&_s(a),it===null&&xs(a)}t.wv=Bu(),vu(t,Ze,n),ue!==null&&(ue.f&Ye)!==0&&(ue.f&(qt|On))===0&&(Zt===null?Mg([t]):Zt.push(t)),!r.is_fork&&po.size>0&&!bu&&Tg()}return e}function Tg(){bu=!1;for(const t of po){(t.f&Ye)!==0&&qe(t,an);let e;try{e=ri(t)}catch{e=!0}e&&fa(t)}po.clear()}function ei(t){j(t,t.v+1)}function vu(t,e,n){var r=t.reactions;if(r!==null)for(var a=r.length,i=0;i<a;i++){var s=r[i],o=s.f,l=(o&Ze)===0;if(l&&qe(s,e),(o&oo)!==0)po.add(s);else if((o&Qe)!==0){var c=s;it==null||it.delete(c),(o&Er)===0&&(o&$t&&(ue===null||(ue.f&so)===0)&&(s.f|=Er),vu(c,an,n))}else if(l){var f=s;(o&rn)!==0&&on!==null&&on.add(f),n!==null?n.push(f):As(f)}}}function ar(t){if(typeof t!="object"||t===null||Ya in t)return t;const e=Vl(t);if(e!==Ap&&e!==Rp)return t;var n=new Map,r=Zl(t),a=xe(0),i=Lr,s=o=>{if(Lr===i)return o();var l=le,c=Lr;Yt(null),Mu(i);var f=o();return Yt(l),Mu(c),f};return r&&n.set("length",xe(t.length)),new Proxy(t,{defineProperty(o,l,c){(!("value"in c)||c.configurable===!1||c.enumerable===!1||c.writable===!1)&&Up();var f=n.get(l);return f===void 0?s(()=>{var p=xe(c.value);return n.set(l,p),p}):j(f,c.value,!0),!0},deleteProperty(o,l){var c=n.get(l);if(c===void 0){if(l in o){const f=s(()=>xe(Ve));n.set(l,f),ei(a)}}else j(c,Ve),ei(a);return!0},get(o,l,c){var m;if(l===Ya)return t;var f=n.get(l),p=l in o;if(f===void 0&&(!p||(m=ta(o,l))!=null&&m.writable)&&(f=s(()=>{var g=ar(p?o[l]:Ve),v=xe(g);return v}),n.set(l,f)),f!==void 0){var d=b(f);return d===Ve?void 0:d}return Reflect.get(o,l,c)},getOwnPropertyDescriptor(o,l){var c=Reflect.getOwnPropertyDescriptor(o,l);if(c&&"value"in c){var f=n.get(l);f&&(c.value=b(f))}else if(c===void 0){var p=n.get(l),d=p==null?void 0:p.v;if(p!==void 0&&d!==Ve)return{enumerable:!0,configurable:!0,value:d,writable:!0}}return c},has(o,l){var d;if(l===Ya)return!0;var c=n.get(l),f=c!==void 0&&c.v!==Ve||Reflect.has(o,l);if(c!==void 0||ue!==null&&(!f||(d=ta(o,l))!=null&&d.writable)){c===void 0&&(c=s(()=>{var m=f?ar(o[l]):Ve,g=xe(m);return g}),n.set(l,c));var p=b(c);if(p===Ve)return!1}return f},set(o,l,c,f){var E;var p=n.get(l),d=l in o;if(r&&l==="length")for(var m=c;m<p.v;m+=1){var g=n.get(m+"");g!==void 0?j(g,Ve):m in o&&(g=s(()=>xe(Ve)),n.set(m+"",g))}if(p===void 0)(!d||(E=ta(o,l))!=null&&E.writable)&&(p=s(()=>xe(void 0)),j(p,ar(c)),n.set(l,p));else{d=p.v!==Ve;var v=s(()=>ar(c));j(p,v)}var w=Reflect.getOwnPropertyDescriptor(o,l);if(w!=null&&w.set&&w.set.call(f,c),!d){if(r&&typeof l=="string"){var x=n.get("length"),S=Number(l);Number.isInteger(S)&&S>=x.v&&j(x,S+1)}ei(a)}return!0},ownKeys(o){b(a);var l=Reflect.ownKeys(o).filter(p=>{var d=n.get(p);return d===void 0||d.v!==Ve});for(var[c,f]of n)f.v!==Ve&&!(c in o)&&l.push(c);return l},setPrototypeOf(){qp()}})}var wu,yu,xu,_u;function Ag(){if(wu===void 0){wu=window,yu=/Firefox/.test(navigator.userAgent);var t=Element.prototype,e=Node.prototype,n=Text.prototype;xu=ta(e,"firstChild").get,_u=ta(e,"nextSibling").get,Xl(t)&&(t[ws]=void 0,t[co]=null,t[ys]=void 0,t.__e=void 0),Xl(n)&&(n[Za]=void 0)}}function Dn(t=""){return document.createTextNode(t)}function ir(t){return xu.call(t)}function ti(t){return _u.call(t)}function z(t,e){return ir(t)}function Mn(t,e=!1){{var n=ir(t);return n instanceof Comment&&n.data===""?ti(n):n}}function H(t,e=1,n=!1){let r=t;for(;e--;)r=ti(r);return r}function Rg(t){t.textContent=""}function ku(){return!1}function Eu(t,e,n){return e==null||e===Jl?n?document.createElement(t,{is:n}):document.createElement(t):n?document.createElementNS(e,t,{is:n}):document.createElementNS(e,t)}function Cg(t){ue===null&&(le===null&&Fp(),zp()),Pn&&Pp()}function Ig(t,e){var n=e.last;n===null?e.last=e.first=t:(n.next=t,t.prev=n,e.last=t)}function Bn(t,e){var n=ue;n!==null&&(n.f&gt)!==0&&(t|=gt);var r={ctx:mt,deps:null,nodes:null,f:t|Ze|$t,first:null,fn:e,last:null,next:null,parent:n,b:n&&n.b,prev:null,teardown:null,wv:0,ac:null};X==null||X.register_created_effect(r);var a=r;if((t&na)!==0)la!==null?la.push(r):Ar.ensure().schedule(r);else if(e!==null){try{fa(r)}catch(s){throw _t(r),s}a.deps===null&&a.teardown===null&&a.nodes===null&&a.first===a.last&&(a.f&ia)===0&&(a=a.first,(t&rn)!==0&&(t&aa)!==0&&a!==null&&(a.f|=aa))}if(a!==null&&(a.parent=n,n!==null&&Ig(a,n),le!==null&&(le.f&Qe)!==0&&(t&On)===0)){var i=le;(i.effects??(i.effects=[])).push(a)}return r}function Rs(){return le!==null&&!sn}function Og(t){const e=Bn(io,null);return qe(e,Ye),e.teardown=t,e}function ni(t){Cg();var e=ue.f,n=!le&&(e&qt)!==0&&mt!==null&&!mt.i;if(n){var r=mt;(r.e??(r.e=[])).push(t)}else return Su(t)}function Su(t){return Bn(na|Lp,t)}function Lg(t){Ar.ensure();const e=Bn(On|ia,t);return(n={})=>new Promise(r=>{n.outro?Ir(e,()=>{_t(e),r(void 0)}):(_t(e),r(void 0))})}function Tu(t){return Bn(na,t)}function Ng(t){return Bn(oa|ia,t)}function Cs(t,e=0){return Bn(io|e,t)}function Ne(t,e=[],n=[],r=[]){bg(r,e,n,a=>{Bn(io,()=>{t(...a.map(b))})})}function Is(t,e=0){var n=Bn(rn|e,t);return n}function Gt(t){return Bn(qt|ia,t)}function Au(t){var e=t.teardown;if(e!==null){const n=Pn,r=le;Lu(!0),Yt(null);try{e.call(null)}finally{Lu(n),Yt(r)}}}function Os(t,e=!1){var n=t.first;for(t.first=t.last=null;n!==null;){const a=n.ac;a!==null&&Xa(()=>{a.abort(Va)});var r=n.next;(n.f&On)!==0?n.parent=null:_t(n,e),n=r}}function Dg(t){for(var e=t.first;e!==null;){var n=e.next;(e.f&qt)===0&&_t(e),e=n}}function _t(t,e=!0){var n=!1;(e||(t.f&Op)!==0)&&t.nodes!==null&&t.nodes.end!==null&&(Ru(t.nodes.start,t.nodes.end),n=!0),t.f|=vs,Os(t,e&&!n),ai(t,0);var r=t.nodes&&t.nodes.t;if(r!==null)for(const i of r)i.stop();Au(t),t.f^=vs,t.f|=Ot;var a=t.parent;a!==null&&a.first!==null&&Cu(t),t.next=t.prev=t.teardown=t.ctx=t.deps=t.fn=t.nodes=t.ac=t.b=null}function Ru(t,e){for(;t!==null;){var n=t===e?null:ti(t);t.remove(),t=n}}function Cu(t){var e=t.parent,n=t.prev,r=t.next;n!==null&&(n.next=r),r!==null&&(r.prev=n),e!==null&&(e.first===t&&(e.first=r),e.last===t&&(e.last=n))}function Ir(t,e,n=!0){var r=[];Iu(t,r,!0);var a=()=>{n&&_t(t),e&&e()},i=r.length;if(i>0){var s=()=>--i||a();for(var o of r)o.out(s)}else a()}function Iu(t,e,n){if((t.f&gt)===0){t.f^=gt;var r=t.nodes&&t.nodes.t;if(r!==null)for(const o of r)(o.is_global||n)&&e.push(o);for(var a=t.first;a!==null;){var i=a.next;if((a.f&On)===0){var s=(a.f&aa)!==0||(a.f&qt)!==0&&(t.f&rn)!==0;Iu(a,e,s?n:!1)}a=i}}}function go(t){Ou(t,!0)}function Ou(t,e){if((t.f&gt)!==0){t.f^=gt,(t.f&Ye)===0&&(qe(t,Ze),Ar.ensure().schedule(t));for(var n=t.first;n!==null;){var r=n.next,a=(n.f&aa)!==0||(n.f&qt)!==0;Ou(n,a?e:!1),n=r}var i=t.nodes&&t.nodes.t;if(i!==null)for(const s of i)(s.is_global||e)&&s.in()}}function Ls(t,e){if(t.nodes)for(var n=t.nodes.start,r=t.nodes.end;n!==null;){var a=n===r?null:ti(n);e.append(n),n=a}}let mo=!1,Pn=!1;function Lu(t){Pn=t}let le=null,sn=!1;function Yt(t){le=t}let ue=null;function wn(t){ue=t}let yn=null;function Nu(t){le!==null&&(yn??(yn=new Set)).add(t)}let kt=null,Lt=0,Zt=null;function Mg(t){Zt=t}let Du=1,Or=0,Lr=Or;function Mu(t){Lr=t}function Bu(){return++Du}function ri(t){var e=t.f;if((e&Ze)!==0)return!0;if(e&Qe&&(t.f&=~Er),(e&an)!==0){for(var n=t.deps,r=n.length,a=0;a<r;a++){var i=n[a];if(ri(i)&&uu(i),i.wv>t.wv)return!0}(e&$t)!==0&&it===null&&qe(t,Ye)}return!1}function Pu(t,e,n=!0){var r=t.reactions;if(r!==null&&!(yn!==null&&yn.has(t)))for(var a=0;a<r.length;a++){var i=r[a];(i.f&Qe)!==0?Pu(i,e,!1):e===i&&(n?qe(i,Ze):(i.f&Ye)!==0&&qe(i,an),As(i))}}function zu(t){var v;var e=kt,n=Lt,r=Zt,a=le,i=yn,s=mt,o=sn,l=Lr,c=t.f;kt=null,Lt=0,Zt=null,le=(c&(qt|On))===0?t:null,yn=null,sa(t.ctx),sn=!1,Lr=++Or,t.ac!==null&&(Xa(()=>{t.ac.abort(Va)}),t.ac=null);try{t.f|=so;var f=t.fn,p=f();t.f|=ra;var d=t.deps,m=X==null?void 0:X.is_fork;if(kt!==null){var g;if(m||ai(t,Lt),d!==null&&Lt>0)for(d.length=Lt+kt.length,g=0;g<kt.length;g++)d[Lt+g]=kt[g];else t.deps=d=kt;if(Rs()&&(t.f&$t)!==0)for(g=Lt;g<d.length;g++)((v=d[g]).reactions??(v.reactions=[])).push(t)}else!m&&d!==null&&Lt<d.length&&(ai(t,Lt),d.length=Lt);if(nu()&&Zt!==null&&!sn&&d!==null&&(t.f&(Qe|an|Ze))===0)for(g=0;g<Zt.length;g++)Pu(Zt[g],t);if(a!==null&&a!==t){if(Or++,a.deps!==null)for(let w=0;w<n;w+=1)a.deps[w].rv=Or;if(e!==null)for(const w of e)w.rv=Or;Zt!==null&&(r===null?r=Zt:r.push(...Zt))}return(t.f&nr)!==0&&(t.f^=nr),p}catch(w){return au(w)}finally{t.f^=so,kt=e,Lt=n,Zt=r,le=a,yn=i,sa(s),sn=o,Lr=l}}function Bg(t,e){let n=e.reactions;if(n!==null){var r=Ep.call(n,t);if(r!==-1){var a=n.length-1;a===0?n=e.reactions=null:(n[r]=n[a],n.pop())}}if(n===null&&(e.f&Qe)!==0&&(kt===null||!ro.call(kt,e))){var i=e;(i.f&$t)!==0&&(i.f^=$t,i.f&=~Er),i.v!==Ve&&xs(i),i.ac!==null&&Xa(()=>{i.ac.abort(Va),i.ac=null}),xg(i),ai(i,0)}}function ai(t,e){var n=t.deps;if(n!==null)for(var r=e;r<n.length;r++)Bg(t,n[r])}function fa(t){var e=t.f;if((e&Ot)===0){qe(t,Ye);var n=ue,r=mo;ue=t,mo=(e&(qt|On))===0;try{(e&(rn|Kl))!==0?Dg(t):Os(t),Au(t);var a=zu(t);t.teardown=typeof a=="function"?a:null,t.wv=Du;var i;Yl&&sg&&(t.f&Ze)!==0&&t.deps}finally{mo=r,ue=n}}}async function Pg(){await Promise.resolve(),kg()}function b(t){var e=t.f,n=(e&Qe)!==0;if(le!==null&&!sn){var r=ue!==null&&(ue.f&Ot)!==0;if(!r&&(yn===null||!yn.has(t))){var a=le.deps;if((le.f&so)!==0)t.rv<Or&&(t.rv=Or,kt===null&&a!==null&&a[Lt]===t?Lt++:kt===null?kt=[t]:kt.push(t));else{le.deps??(le.deps=[]),ro.call(le.deps,t)||le.deps.push(t);var i=t.reactions;i===null?t.reactions=[le]:ro.call(i,le)||i.push(le)}}}if(Pn&&Rr.has(t))return Rr.get(t);if(n){var s=t;if(Pn){var o=s.v;return((s.f&Ye)===0&&s.reactions!==null||ju(s))&&(o=_s(s)),Rr.set(s,o),o}var l=(s.f&$t)===0&&!sn&&le!==null&&(mo||(le.f&$t)!==0),c=(s.f&ra)===0;ri(s)&&(l&&(s.f|=$t),uu(s)),l&&!c&&(fu(s),Fu(s))}if(it!=null&&it.has(t))return it.get(t);if((t.f&nr)!==0)throw t.v;return t.v}function Fu(t){if(t.f|=$t,t.deps!==null)for(const e of t.deps)(e.reactions??(e.reactions=[])).push(t),(e.f&Qe)!==0&&(e.f&$t)===0&&(fu(e),Fu(e))}function ju(t){if(t.v===Ve)return!0;if(t.deps===null)return!1;for(const e of t.deps)if(Rr.has(e)||(e.f&Qe)!==0&&ju(e))return!0;return!1}function ii(t){var e=sn;try{return sn=!0,t()}finally{sn=e}}const zg=["touchstart","touchmove"];function Fg(t){return zg.includes(t)}const Nr=Symbol("events"),Hu=new Set,Ns=new Set;function Ce(t,e,n){(e[Nr]??(e[Nr]={}))[t]=n}function Dr(t){for(var e=0;e<t.length;e++)Hu.add(t[e]);for(var n of Ns)n(t)}let Uu=null;function qu(t){var v,w;var e=this,n=e.ownerDocument,r=t.type,a=((v=t.composedPath)==null?void 0:v.call(t))||[],i=a[0]||t.target;Uu=t;var s=0,o=Uu===t&&t[Nr];if(o){var l=a.indexOf(o);if(l!==-1&&(e===document||e===window)){t[Nr]=e;return}var c=a.indexOf(e);if(c===-1)return;l<=c&&(s=l)}if(i=a[s]||t.target,i!==e){Sp(t,"currentTarget",{configurable:!0,get(){return i||n}});var f=le,p=ue;Yt(null),wn(null);try{for(var d,m=[];i!==null&&i!==e;){try{var g=(w=i[Nr])==null?void 0:w[r];g!=null&&(!i.disabled||t.target===i)&&g.call(i,t)}catch(x){d?m.push(x):d=x}if(t.cancelBubble)break;s++,i=s<a.length?a[s]:null}if(d){for(let x of m)queueMicrotask(()=>{throw x});throw d}}finally{t[Nr]=e,delete t.currentTarget,Yt(f),wn(p)}}}const Ds=((jf=globalThis==null?void 0:globalThis.window)==null?void 0:jf.trustedTypes)&&globalThis.window.trustedTypes.createPolicy("svelte-trusted-html",{createHTML:t=>t});function jg(t){return(Ds==null?void 0:Ds.createHTML(t))??t}function Hg(t){var e=Eu("template");return e.innerHTML=jg(t.replaceAll("<!>","<!---->")),e.content}function da(t,e){var n=ue;n.nodes===null&&(n.nodes={start:t,end:e,a:null,t:null})}function ie(t,e){var n=(e&eg)!==0,r=(e&tg)!==0,a,i=!t.startsWith("<!>");return()=>{a===void 0&&(a=Hg(i?t:"<!>"+t),n||(a=ir(a)));var s=r||yu?document.importNode(a,!0):a.cloneNode(!0);if(n){var o=ir(s),l=s.lastChild;da(o,l)}else da(s,s);return s}}function $u(t=""){{var e=Dn(t+"");return da(e,e),e}}function Ms(){var t=document.createDocumentFragment(),e=document.createComment(""),n=Dn();return t.append(e,n),da(e,n),t}function Q(t,e){t!==null&&t.before(e)}function Te(t,e){var n=e==null?"":typeof e=="object"?`${e}`:e;n!==(t[Za]??(t[Za]=t.nodeValue))&&(t[Za]=n,t.nodeValue=`${n}`)}function Ug(t,e){return qg(t,e)}const bo=new Map;function qg(t,{target:e,anchor:n,props:r={},events:a,context:i,intro:s=!0,transformError:o}){Ag();var l=void 0,c=Lg(()=>{var f=n??e.appendChild(Dn());gg(f,{pending:()=>{}},m=>{Ln({});var g=mt;i&&(g.c=i),a&&(r.$$events=a),l=t(m,r)||{},Nn()},o);var p=new Set,d=m=>{for(var g=0;g<m.length;g++){var v=m[g];if(!p.has(v)){p.add(v);var w=Fg(v);for(const E of[e,document]){var x=bo.get(E);x===void 0&&(x=new Map,bo.set(E,x));var S=x.get(v);S===void 0?(E.addEventListener(v,qu,{passive:w}),x.set(v,1)):x.set(v,S+1)}}}};return d(ao(Hu)),Ns.add(d),()=>{var w;for(var m of p)for(const x of[e,document]){var g=bo.get(x),v=g.get(m);--v==0?(x.removeEventListener(m,qu),g.delete(m),g.size===0&&bo.delete(x)):g.set(m,v)}Ns.delete(d),f!==n&&((w=f.parentNode)==null||w.removeChild(f))}});return Bs.set(l,c),l}let Bs=new WeakMap;function $g(t,e){const n=Bs.get(t);return n?(Bs.delete(t),n(e)):Promise.resolve()}class Gg{constructor(e,n=!0){k(this,"anchor");M(this,un,new Map);M(this,En,new Map);M(this,Pt,new Map);M(this,Gr,new Set);M(this,Ri,!0);M(this,Ci,e=>{if(u(this,un).has(e)){var n=u(this,un).get(e),r=u(this,En).get(n);if(r)go(r),u(this,Gr).delete(n);else{var a=u(this,Pt).get(n);a&&(go(a.effect),u(this,En).set(n,a.effect),u(this,Pt).delete(n),a.fragment.lastChild.remove(),this.anchor.before(a.fragment),r=a.effect)}for(const[i,s]of u(this,un)){if(u(this,un).delete(i),i===e)break;const o=u(this,Pt).get(s);o&&(_t(o.effect),u(this,Pt).delete(s))}for(const[i,s]of u(this,En)){if(i===n||u(this,Gr).has(i))continue;const o=()=>{if(Array.from(u(this,un).values()).includes(i)){var c=document.createDocumentFragment();Ls(s,c),c.append(Dn()),u(this,Pt).set(i,{effect:s,fragment:c})}else _t(s);u(this,Gr).delete(i),u(this,En).delete(i)};u(this,Ri)||!r?(u(this,Gr).add(i),Ir(s,o,!1)):o()}}});M(this,Lo,e=>{u(this,un).delete(e);const n=Array.from(u(this,un).values());for(const[r,a]of u(this,Pt))n.includes(r)||(_t(a.effect),u(this,Pt).delete(r))});this.anchor=e,T(this,Ri,n)}ensure(e,n){var r=X,a=ku();if(n&&!u(this,En).has(e)&&!u(this,Pt).has(e))if(a){var i=document.createDocumentFragment(),s=Dn();i.append(s),u(this,Pt).set(e,{effect:Gt(()=>n(s)),fragment:i})}else u(this,En).set(e,Gt(()=>n(this.anchor)));if(u(this,un).set(r,e),a){for(const[o,l]of u(this,En))o===e?r.unskip_effect(l):r.skip_effect(l);for(const[o,l]of u(this,Pt))o===e?r.unskip_effect(l.effect):r.skip_effect(l.effect);r.oncommit(u(this,Ci)),r.ondiscard(u(this,Lo))}else u(this,Ci).call(this,r)}}un=new WeakMap,En=new WeakMap,Pt=new WeakMap,Gr=new WeakMap,Ri=new WeakMap,Ci=new WeakMap,Lo=new WeakMap;function fe(t,e,n=!1){var r=new Gg(t),a=n?aa:0;function i(s,o){r.ensure(s,o)}Is(()=>{var s=!1;e((o,l=0)=>{s=!0,i(l,o)}),s||i(-1,null)},a)}function Yg(t,e,n){for(var r=[],a=e.length,i,s=e.length,o=0;o<a;o++){let p=e[o];Ir(p,()=>{if(i){if(i.pending.delete(p),i.done.add(p),i.pending.size===0){var d=t.outrogroups;Ps(t,ao(i.done)),d.delete(i),d.size===0&&(t.outrogroups=null)}}else s-=1},!1)}if(s===0){var l=r.length===0&&n!==null;if(l){var c=n,f=c.parentNode;Rg(f),f.append(c),t.items.clear()}Ps(t,e,!l)}else i={pending:new Set(e),done:new Set},(t.outrogroups??(t.outrogroups=new Set)).add(i)}function Ps(t,e,n=!0){var r;if(t.pending.size>0){r=new Set;for(const s of t.pending.values())for(const o of s)r.add(t.items.get(o).e)}for(var a=0;a<e.length;a++){var i=e[a];if(r!=null&&r.has(i)){i.f|=vn;const s=document.createDocumentFragment();Ls(i,s)}else _t(e[a],n)}}var Gu;function Mr(t,e,n,r,a,i=null){var s=t,o=new Map,l=(e&Ql)!==0;if(l){var c=t;s=c.appendChild(Dn())}var f=null,p=lu(()=>{var E=n();return Zl(E)?E:E==null?[]:ao(E)}),d,m=new Map,g=!0;function v(E){(S.effect.f&Ot)===0&&(S.pending.delete(E),S.fallback=f,Zg(S,d,s,e,r),f!==null&&(d.length===0?(f.f&vn)===0?go(f):(f.f^=vn,si(f,null,s)):Ir(f,()=>{f=null})))}function w(E){S.pending.delete(E)}var x=Is(()=>{d=b(p);for(var E=d.length,R=new Set,C=X,N=ku(),D=0;D<E;D+=1){var I=d[D],F=r(I,D),G=g?null:o.get(F);G?(G.v&&ua(G.v,I),G.i&&ua(G.i,D),N&&C.unskip_effect(G.e)):(G=Vg(o,g?s:Gu??(Gu=Dn()),I,F,D,a,e,n),g||(G.e.f|=vn),o.set(F,G)),R.add(F)}if(E===0&&i&&!f&&(g?f=Gt(()=>i(s)):(f=Gt(()=>i(Gu??(Gu=Dn()))),f.f|=vn)),E>R.size&&Bp(),!g)if(m.set(C,R),N){for(const[oe,B]of o)R.has(oe)||C.skip_effect(B.e);C.oncommit(v),C.ondiscard(w)}else v(C);b(p)}),S={effect:x,items:o,pending:m,outrogroups:null,fallback:f};g=!1}function oi(t){for(;t!==null&&(t.f&qt)===0;)t=t.next;return t}function Zg(t,e,n,r,a){var G,oe,B,$,Z,te,se,Ee,Be;var i=(r&Vp)!==0,s=e.length,o=t.items,l=oi(t.effect.first),c,f=null,p,d=[],m=[],g,v,w,x;if(i)for(x=0;x<s;x+=1)g=e[x],v=a(g,x),w=o.get(v).e,(w.f&vn)===0&&((oe=(G=w.nodes)==null?void 0:G.a)==null||oe.measure(),(p??(p=new Set)).add(w));for(x=0;x<s;x+=1){if(g=e[x],v=a(g,x),w=o.get(v).e,t.outrogroups!==null)for(const U of t.outrogroups)U.pending.delete(w),U.done.delete(w);if((w.f&gt)!==0&&(go(w),i&&(($=(B=w.nodes)==null?void 0:B.a)==null||$.unfix(),(p??(p=new Set)).delete(w))),(w.f&vn)!==0)if(w.f^=vn,w===l)si(w,null,n);else{var S=f?f.next:l;w===t.effect.last&&(t.effect.last=w.prev),w.prev&&(w.prev.next=w.next),w.next&&(w.next.prev=w.prev),or(t,f,w),or(t,w,S),si(w,S,n),f=w,d=[],m=[],l=oi(f.next);continue}if(w!==l){if(c!==void 0&&c.has(w)){if(d.length<m.length){var E=m[0],R;f=E.prev;var C=d[0],N=d[d.length-1];for(R=0;R<d.length;R+=1)si(d[R],E,n);for(R=0;R<m.length;R+=1)c.delete(m[R]);or(t,C.prev,N.next),or(t,f,C),or(t,N,E),l=E,f=N,x-=1,d=[],m=[]}else c.delete(w),si(w,l,n),or(t,w.prev,w.next),or(t,w,f===null?t.effect.first:f.next),or(t,f,w),f=w;continue}for(d=[],m=[];l!==null&&l!==w;)(c??(c=new Set)).add(l),m.push(l),l=oi(l.next);if(l===null)continue}(w.f&vn)===0&&d.push(w),f=w,l=oi(w.next)}if(t.outrogroups!==null){for(const U of t.outrogroups)U.pending.size===0&&(Ps(t,ao(U.done)),(Z=t.outrogroups)==null||Z.delete(U));t.outrogroups.size===0&&(t.outrogroups=null)}if(l!==null||c!==void 0){var D=[];if(c!==void 0)for(w of c)(w.f&gt)===0&&D.push(w);for(;l!==null;)(l.f&gt)===0&&l!==t.fallback&&D.push(l),l=oi(l.next);var I=D.length;if(I>0){var F=(r&Ql)!==0&&s===0?n:null;if(i){for(x=0;x<I;x+=1)(se=(te=D[x].nodes)==null?void 0:te.a)==null||se.measure();for(x=0;x<I;x+=1)(Be=(Ee=D[x].nodes)==null?void 0:Ee.a)==null||Be.fix()}Yg(t,D,F)}}i&&Tr(()=>{var U,de;if(p!==void 0)for(w of p)(de=(U=w.nodes)==null?void 0:U.a)==null||de.apply()})}function Vg(t,e,n,r,a,i,s,o){var l=(s&Yp)!==0?(s&Xp)===0?Sg(n,!1,!1):Cr(n):null,c=(s&Zp)!==0?Cr(a):null;return{v:l,i:c,e:Gt(()=>(i(e,l??n,c??a,o),()=>{t.delete(r)}))}}function si(t,e,n){if(t.nodes)for(var r=t.nodes.start,a=t.nodes.end,i=e&&(e.f&vn)===0?e.nodes.start:n;r!==null;){var s=ti(r);if(i.before(r),r===a)return;r=s}}function or(t,e,n){e===null?t.effect.first=n:e.next=n,n===null?t.effect.last=e:n.prev=e}function Xg(t,e,n=!1,r=!1,a=!1,i=!1){var s=t,o="";if(n)var l=t;Ne(()=>{var c=ue;if(o!==(o=e()??"")){if(n){c.nodes=null,l.innerHTML=o,o!==""&&da(ir(l),l.lastChild);return}if(c.nodes!==null&&(Ru(c.nodes.start,c.nodes.end),c.nodes=null),o!==""){var f=r?ng:a?rg:void 0,p=Eu(r?"svg":a?"math":"template",f);p.innerHTML=o;var d=r||a?p:p.content;if(da(ir(d),d.lastChild),r||a)for(;ir(d);)s.before(ir(d));else s.before(d)}}})}function zs(t,e,n){Tu(()=>{var r=ii(()=>e(t,n==null?void 0:n())||{});if(r!=null&&r.destroy)return()=>r.destroy()})}const Yu=[...` 	
\r\f \v\uFEFF`];function Wg(t,e,n){var r=t==null?"":""+t;if(n){for(var a of Object.keys(n))if(n[a])r=r?r+" "+a:a;else if(r.length)for(var i=a.length,s=0;(s=r.indexOf(a,s))>=0;){var o=s+i;(s===0||Yu.includes(r[s-1]))&&(o===r.length||Yu.includes(r[o]))?r=(s===0?"":r.substring(0,s))+r.substring(o+1):s=o}}return r===""?null:r}function Zu(t,e=!1){var n=e?" !important;":";",r="";for(var a of Object.keys(t)){var i=t[a];i!=null&&i!==""&&(r+=" "+a+": "+i+n)}return r}function Kg(t,e){if(e){var n="",r,a;return Array.isArray(e)?(r=e[0],a=e[1]):r=e,r&&(n+=Zu(r)),a&&(n+=Zu(a,!0)),n=n.trim(),n===""?null:n}return String(t)}function sr(t,e,n,r,a,i){var s=t[ws];if(s!==n||s===void 0){var o=Wg(n,r,i);o==null?t.removeAttribute("class"):t.className=o,t[ws]=n}else if(i&&a!==i)for(var l in i){var c=!!i[l];(a==null||c!==!!a[l])&&t.classList.toggle(l,c)}return i}function Fs(t,e={},n,r){for(var a in n){var i=n[a];e[a]!==i&&(n[a]==null?t.style.removeProperty(a):t.style.setProperty(a,i,r))}}function vo(t,e,n,r){var a=t[ys];if(a!==e){var i=Kg(e,r);i==null?t.removeAttribute("style"):t.style.cssText=i,t[ys]=e}else r&&(Array.isArray(r)?(Fs(t,n==null?void 0:n[0],r[0]),Fs(t,n==null?void 0:n[1],r[1],"important")):Fs(t,n,r));return r}const Qg=Symbol("is custom element"),Jg=Symbol("is html");function Je(t,e,n,r){var a=em(t);a[e]!==(a[e]=n)&&(e==="loading"&&(t[Dp]=n),n==null?t.removeAttribute(e):typeof n!="string"&&tm(t).includes(e)?t[e]=n:t.setAttribute(e,n))}function em(t){return t[co]??(t[co]={[Qg]:t.nodeName.includes("-"),[Jg]:t.namespaceURI===Jl})}var Vu=new Map;function tm(t){var e=t.getAttribute("is")||t.nodeName,n=Vu.get(e);if(n)return n;Vu.set(e,n=[]);for(var r,a=t,i=Element.prototype;i!==a;){r=Tp(a);for(var s in r)r[s].set&&s!=="innerHTML"&&s!=="textContent"&&s!=="innerText"&&n.push(s);a=Vl(a)}return n}function js(t,e,n=e){var r=new WeakSet;dg(t,"input",async a=>{var i=a?t.defaultValue:t.value;if(i=Hs(t)?Us(i):i,n(i),X!==null&&r.add(X),await Pg(),i!==(i=e())){var s=t.selectionStart,o=t.selectionEnd,l=t.value.length;if(t.value=i??"",o!==null){var c=t.value.length;s===o&&o===l&&c>l?(t.selectionStart=c,t.selectionEnd=c):(t.selectionStart=s,t.selectionEnd=Math.min(o,c))}}}),ii(e)==null&&t.value&&(n(Hs(t)?Us(t.value):t.value),X!==null&&r.add(X)),Cs(()=>{var a=e();if(t===document.activeElement){var i=X;if(r.has(i))return}Hs(t)&&a===Us(t.value)||t.type==="date"&&!a&&!t.value||a!==t.value&&(t.value=a??"")})}function Hs(t){var e=t.type;return e==="number"||e==="range"}function Us(t){return t===""?null:+t}function qs(t,e){return t===e||(t==null?void 0:t[Ya])===e}function nm(t={},e,n,r){var a=mt.r,i=ue;return Tu(()=>{var s,o;return Cs(()=>{s=o,o=[],ii(()=>{qs(n(...o),t)||(e(t,...o),s&&qs(n(...s),t)&&e(null,...s))})}),()=>{let l=i;for(;l!==a&&l.parent!==null&&l.parent.f&vs;)l=l.parent;const c=()=>{o&&qs(n(...o),t)&&e(null,...o)},f=l.teardown;l.teardown=()=>{c(),f==null||f()}}}),t}function zn(t,e,n,r){var R;var a=!0,i=(n&Qp)!==0,s=(n&Jp)!==0,o=r,l=!0,c=void 0,f=()=>s&&a?(c??(c=Wa(r)),b(c)):(l&&(l=!1,o=s?ii(r):r),o);let p;if(i){var d=Ya in t||Np in t;p=((R=ta(t,e))==null?void 0:R.set)??(d&&e in t?C=>t[e]=C:void 0)}var m,g=!1;i?[m,g]=ug(()=>t[e]):m=t[e],m===void 0&&r!==void 0&&(m=f(),p&&(Hp(),p(m)));var v;if(v=()=>{var C=t[e];return C===void 0?f():(l=!0,C)},(n&Kp)===0)return v;if(p){var w=t.$$legacy;return(function(C,N){return arguments.length>0?((!N||w||g)&&p(N?v():C),C):v()})}var x=!1,S=((n&Wp)!==0?Wa:lu)(()=>(x=!1,v()));i&&b(S);var E=ue;return(function(C,N){if(arguments.length>0){const D=N?b(S):i?ar(C):C;return j(S,D),x=!0,o!==void 0&&(o=D),C}return Pn&&x||(E.f&Ot)!==0?S.v:b(S)})}const rm="5";typeof window<"u"&&((Hf=window.__svelte??(window.__svelte={})).v??(Hf.v=new Set)).add(rm);const Xu="any-comments-preview";function $s(t){if(!(typeof CSS>"u"||!CSS.highlights))try{t?CSS.highlights.set(Xu,new Highlight(t)):CSS.highlights.delete(Xu)}catch{}}function Wu(t){let e=0;for(let n=0;n<t.length;n++)e=e*31+t.charCodeAt(n)>>>0;return e%360}function am(t){return t.display_name??`访客-${t.author_pubkey.slice(0,6)}`}function im(t,e=Date.now()){const n=Math.max(0,e-t),r=Math.floor(n/6e4);if(r<1)return"刚刚";if(r<60)return`${r} 分钟前`;const a=Math.floor(r/60);if(a<24)return`${a} 小时前`;const i=Math.floor(a/24);if(i<30)return`${i} 天前`;const s=new Date(t),o=String(s.getMonth()+1).padStart(2,"0"),l=String(s.getDate()).padStart(2,"0");return`${s.getFullYear()}-${o}-${l}`}function wo(t,e=40){const n=t.replace(/\s+/g," ").trim();return n.length>e?`${n.slice(0,e)}…`:n}function om(t){const e=new Date(t);return`${e.getMonth()+1}月${e.getDate()}日`}function sm(t,e=40){switch(t.type){case"text":return wo(t.quote.exact,e);case"container":return wo(t.selector,e);case"media-time":{const n=r=>{const a=Math.floor(r/60),i=Math.floor(r%60);return`${a}:${String(i).padStart(2,"0")}`};return t.end!==void 0?`片段 ${n(t.time)}–${n(t.end)}`:`时间点 ${n(t.time)}`}}}function cm(t){const e=new Map,n=[];for(const a of t)e.set(a.id,{comment:a,children:[]});for(const a of t){const i=e.get(a.id);if(!i)continue;const s=a.parent_id!==null?e.get(a.parent_id):void 0;s?s.children.push(i):n.push(i)}const r=(a,i)=>a.comment.created_at-i.comment.created_at;n.sort(r);for(const a of e.values())a.children.sort(r);return n}function lm(t){var s;const e=cm(t),n=[],r=[],a=new Map;for(const o of e){const l=o.comment;if(l.anchor===null)n.push(o);else if(l.anchor_status==="orphaned")r.push(o);else{const c=JSON.stringify(l.anchor),f=a.get(c);f?f.push(o):a.set(c,[o])}}const i=[];for(const[o,l]of a){const c=l[0];!c||c.comment.anchor===null||i.push({key:o,label:sm(c.comment.anchor),fullQuote:c.comment.anchor.type==="text"?c.comment.anchor.quote.exact:null,pos:c.comment.anchor.type==="text"?((s=c.comment.anchor.position)==null?void 0:s.start)??null:null,locateId:c.comment.id,threads:l})}return{docThreads:n,groups:i,orphans:r}}function Gs(t){let e=0;for(const n of t)e+=1+Gs(n.children);return e}function um(t){const e=[],n=[];for(const r of t)r.status==="deleted"?r.expires_at!==null&&n.push(r):e.push(r);return{live:e,expired:n}}var fm=ie('<div class="ac-meta-fields"></div>'),dm=ie('<div class="ac-error"> </div>'),hm=ie('<button type="button" class="ac-btn ac-ghost">取消</button>'),pm=ie('<div class="ac-composer"><!> <textarea rows="3" aria-label="评论输入框"></textarea> <!> <div class="ac-composer-actions"><!> <button type="button" class="ac-btn ac-primary"> </button></div></div>');function Ys(t,e){Ln(e,!0);let n=zn(e,"placeholder",3,"写下你的评论…（支持 Markdown）"),r=zn(e,"submitLabel",3,"发布"),a=zn(e,"autofocus",3,!1),i=xe(""),s=xe(!1),o=xe(null),l,c=null;ni(()=>{a()&&(l==null||l.focus())});function f(I){c=e.metaFields?e.metaFields(I):null}async function p(){const I=b(i).trim();if(!(!I||b(s))){j(s,!0),j(o,null);try{await e.onSubmit(I,(c==null?void 0:c())??null),j(i,"")}catch(F){console.error("[any-comments] 评论提交失败:",F),j(o,`提交失败：${F instanceof Error?F.message:String(F)}`)}finally{j(s,!1)}}}function d(I){I.key==="Enter"&&(I.metaKey||I.ctrlKey)&&(I.preventDefault(),p())}var m=pm(),g=z(m);{var v=I=>{var F=fm();zs(F,G=>f==null?void 0:f(G)),Q(I,F)};fe(g,I=>{e.metaFields&&I(v)})}var w=H(g,2);nm(w,I=>l=I,()=>l);var x=H(w,2);{var S=I=>{var F=dm(),G=z(F);Ne(()=>Te(G,b(o))),Q(I,F)};fe(x,I=>{b(o)&&I(S)})}var E=H(x,2),R=z(E);{var C=I=>{var F=hm();Ce("click",F,function(...G){var oe;(oe=e.onCancel)==null||oe.apply(this,G)}),Q(I,F)};fe(R,I=>{e.onCancel&&I(C)})}var N=H(R,2),D=z(N);Ne(I=>{Je(w,"placeholder",n()),N.disabled=I,Te(D,b(s)?"提交中…":r())},[()=>!b(i).trim()||b(s)]),Ce("keydown",w,d),js(w,()=>b(i),I=>j(i,I)),Ce("click",N,()=>void p()),Q(t,m),Nn()}Dr(["keydown","click"]);var gm=ie('<blockquote class="ac-compose-quote"> </blockquote>'),mm=ie('<div class="ac-compose-card"><!> <!></div>');function ci(t,e){Ln(e,!0);let n=zn(e,"showQuote",3,!0);function r(l){return l.type==="text"?wo(l.quote.exact,80):l.type==="media-time"?`时间点 ${l.time}s`:"页面区域"}var a=mm(),i=z(a);{var s=l=>{var c=gm(),f=z(c);Ne(p=>{Je(c,"title",e.anchor.type==="text"?e.anchor.quote.exact:void 0),Te(f,`“${p??""}”`)},[()=>r(e.anchor)]),Q(l,c)};fe(i,l=>{n()&&l(s)})}var o=H(i,2);Ys(o,{submitLabel:"发布",placeholder:"就这段原文说点什么…",autofocus:!0,get onSubmit(){return e.onSubmit},get onCancel(){return e.onCancel},get metaFields(){return e.metaFields}}),Q(t,a),Nn()}var bm=ie('<button type="button"> </button>'),vm=ie('<div class="ac-error"> </div>'),wm=ie('<div class="ac-docaction-pop"><div class="ac-docaction-fields"></div> <!> <div class="ac-docaction-actions"><button type="button" class="ac-btn ac-primary"> </button></div></div>'),ym=ie('<div class="ac-docbar-composer"><!></div>'),xm=ie('<div class="ac-docbar"><button type="button" aria-label="点赞本文" title="点赞本文"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 21s-7.5-4.9-10-9.3C.5 8 2.4 4.5 6 4.5c2.2 0 3.6 1.2 6 3.8 2.4-2.6 3.8-3.8 6-3.8 3.6 0 5.5 3.5 4 7.2C19.5 16.1 12 21 12 21z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg> <span> </span></button> <span class="ac-sep"></span> <button type="button" class="ac-docbar-btn ac-docbar-count" title="查看全部评论" aria-label="查看全部评论"> </button> <!> <span class="ac-sep"></span> <button type="button" class="ac-docbar-btn ac-write-btn"> </button></div> <!> <!>',1);function _m(t,e){Ln(e,!0);let n=zn(e,"docActions",19,()=>[]),r=xe(!1),a=xe(null),i=null,s=xe(null),o=xe(!1),l=xe(null);async function c(){e.page&&await e.engine.toggleLike("page",e.page.page_id)}async function f(R,C){await e.engine.submitComment({content:R,anchor:null,...C!==null?{meta:C}:{}}),j(r,!1)}function p(){j(r,!b(r)),b(r)&&m()}function d(R){var C;if(((C=b(a))==null?void 0:C.id)===R.id){m();return}j(r,!1),j(a,R,!0),j(l,null),j(s,null)}function m(){j(a,null),i=null,j(s,null),j(l,null)}function g(R){var C;i=((C=b(a))==null?void 0:C.render(R))??null,j(s,(i==null?void 0:i())??null,!0)}function v(){j(s,(i==null?void 0:i())??null,!0)}async function w(){if(!b(a)||b(o))return;const R=(i==null?void 0:i())??null;if(R!==null){j(o,!0),j(l,null);try{await e.engine.submitComment({content:"",meta:R}),m()}catch(C){console.error("[any-comments] 微互动提交失败:",C),j(l,`提交失败：${C instanceof Error?C.message:String(C)}`)}finally{j(o,!1)}}}var x=Ms(),S=Mn(x);{var E=R=>{var C=xm(),N=Mn(C),D=z(N);let I;var F=z(D),G=z(F),oe=H(F,2),B=z(oe),$=H(D,4),Z=z($),te=H($,2);Mr(te,17,n,he=>he.id,(he,ge)=>{var L=bm();let V;var Oe=z(L);Ne(()=>{var De,He;V=sr(L,1,"ac-docbar-btn ac-docaction-btn",null,V,{"ac-docaction-open":((De=b(a))==null?void 0:De.id)===b(ge).id}),Je(L,"data-docaction-id",b(ge).id),Je(L,"title",b(ge).title??b(ge).label),Je(L,"aria-label",b(ge).title??b(ge).label),Je(L,"aria-expanded",((He=b(a))==null?void 0:He.id)===b(ge).id),Te(Oe,b(ge).label)}),Ce("click",L,()=>d(b(ge))),Q(he,L)});var se=H(te,4),Ee=z(se),Be=H(N,2);{var U=he=>{var ge=wm(),L=z(ge);zs(L,me=>g==null?void 0:g(me));var V=H(L,2);{var Oe=me=>{var W=vm(),ft=z(W);Ne(()=>Te(ft,b(l))),Q(me,W)};fe(V,me=>{b(l)&&me(Oe)})}var De=H(V,2),He=z(De),ut=z(He);Ne(()=>{Je(ge,"data-docaction-pop",b(a).id),He.disabled=b(s)===null||b(o),Te(ut,b(o)?"提交中…":"发布")}),Ce("input",L,v),Ce("change",L,v),Ce("click",L,v),Ce("click",He,()=>void w()),Q(he,ge)};fe(Be,he=>{b(a)&&he(U)})}var de=H(Be,2);{var ne=he=>{var ge=ym(),L=z(ge);Ys(L,{submitLabel:"发布",placeholder:"写下你的评论…（支持 Markdown）",onSubmit:f,onCancel:()=>j(r,!1),get metaFields(){return e.metaFields}}),Q(he,ge)};fe(de,he=>{b(r)&&he(ne)})}Ne(()=>{I=sr(D,1,"ac-docbar-btn ac-like-btn",null,I,{"ac-liked":e.page.liked_by_me}),Je(G,"fill",e.page.liked_by_me?"currentColor":"none"),Te(B,e.page.like_count),Te(Z,`💬 ${e.commentCount??e.page.comment_count??""} 条评论`),Te(Ee,b(r)?"收起":"写评论")}),Ce("click",D,c),Ce("click",$,()=>{var he;return(he=e.onOpenComments)==null?void 0:he.call(e)}),Ce("click",se,p),Q(R,C)};fe(S,R=>{e.page&&R(E)})}Q(t,x),Nn()}Dr(["click","input","change"]);/*! @license DOMPurify 3.4.12 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.12/LICENSE */function Ku(t,e){(e==null||e>t.length)&&(e=t.length);for(var n=0,r=Array(e);n<e;n++)r[n]=t[n];return r}function km(t){if(Array.isArray(t))return t}function Em(t,e){var n=t==null?null:typeof Symbol<"u"&&t[Symbol.iterator]||t["@@iterator"];if(n!=null){var r,a,i,s,o=[],l=!0,c=!1;try{if(i=(n=n.call(t)).next,e!==0)for(;!(l=(r=i.call(n)).done)&&(o.push(r.value),o.length!==e);l=!0);}catch(f){c=!0,a=f}finally{try{if(!l&&n.return!=null&&(s=n.return(),Object(s)!==s))return}finally{if(c)throw a}}return o}}function Sm(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function Tm(t,e){return km(t)||Em(t,e)||Am(t,e)||Sm()}function Am(t,e){if(t){if(typeof t=="string")return Ku(t,e);var n={}.toString.call(t).slice(8,-1);return n==="Object"&&t.constructor&&(n=t.constructor.name),n==="Map"||n==="Set"?Array.from(t):n==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?Ku(t,e):void 0}}const Qu=Object.entries,Ju=Object.setPrototypeOf,Rm=Object.isFrozen,Cm=Object.getPrototypeOf,Im=Object.getOwnPropertyDescriptor;let ot=Object.freeze,st=Object.seal,ha=Object.create,ef=typeof Reflect<"u"&&Reflect,Zs=ef.apply,Vs=ef.construct;ot||(ot=function(e){return e}),st||(st=function(e){return e}),Zs||(Zs=function(e,n){for(var r=arguments.length,a=new Array(r>2?r-2:0),i=2;i<r;i++)a[i-2]=arguments[i];return e.apply(n,a)}),Vs||(Vs=function(e){for(var n=arguments.length,r=new Array(n>1?n-1:0),a=1;a<n;a++)r[a-1]=arguments[a];return new e(...r)});const pa=$e(Array.prototype.forEach),Om=$e(Array.prototype.lastIndexOf),tf=$e(Array.prototype.pop),ga=$e(Array.prototype.push),Lm=$e(Array.prototype.splice),cr=Array.isArray,li=$e(String.prototype.toLowerCase),Xs=$e(String.prototype.toString),nf=$e(String.prototype.match),ui=$e(String.prototype.replace),rf=$e(String.prototype.indexOf),Nm=$e(String.prototype.trim),Dm=$e(Number.prototype.toString),Mm=$e(Boolean.prototype.toString),af=typeof BigInt>"u"?null:$e(BigInt.prototype.toString),of=typeof Symbol>"u"?null:$e(Symbol.prototype.toString),et=$e(Object.prototype.hasOwnProperty),fi=$e(Object.prototype.toString),tt=$e(RegExp.prototype.test),Br=Bm(TypeError);function $e(t){return function(e){e instanceof RegExp&&(e.lastIndex=0);for(var n=arguments.length,r=new Array(n>1?n-1:0),a=1;a<n;a++)r[a-1]=arguments[a];return Zs(t,e,r)}}function Bm(t){return function(){for(var e=arguments.length,n=new Array(e),r=0;r<e;r++)n[r]=arguments[r];return Vs(t,n)}}function pe(t,e){let n=arguments.length>2&&arguments[2]!==void 0?arguments[2]:li;if(Ju&&Ju(t,null),!cr(e))return t;let r=e.length;for(;r--;){let a=e[r];if(typeof a=="string"){const i=n(a);i!==a&&(Rm(e)||(e[r]=i),a=i)}t[a]=!0}return t}function Pm(t){for(let e=0;e<t.length;e++)et(t,e)||(t[e]=null);return t}function bt(t){const e=ha(null);for(const r of Qu(t)){var n=Tm(r,2);const a=n[0],i=n[1];et(t,a)&&(cr(i)?e[a]=Pm(i):i&&typeof i=="object"&&i.constructor===Object?e[a]=bt(i):e[a]=i)}return e}function zm(t){switch(typeof t){case"string":return t;case"number":return Dm(t);case"boolean":return Mm(t);case"bigint":return af?af(t):"0";case"symbol":return of?of(t):"Symbol()";case"undefined":return fi(t);case"function":case"object":{if(t===null)return fi(t);const e=t,n=xn(e,"toString");if(typeof n=="function"){const r=n(e);return typeof r=="string"?r:fi(r)}return fi(t)}default:return fi(t)}}function xn(t,e){for(;t!==null;){const r=Im(t,e);if(r){if(r.get)return $e(r.get);if(typeof r.value=="function")return $e(r.value)}t=Cm(t)}function n(){return null}return n}function Fm(t){try{return tt(t,""),!0}catch{return!1}}const sf=ot(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),Ws=ot(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),Ks=ot(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),jm=ot(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),Qs=ot(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),Hm=ot(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),cf=ot(["#text"]),lf=ot(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","command","commandfor","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns"]),Js=ot(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dominant-baseline","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-orientation","text-rendering","textlength","type","u1","u2","unicode","values","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),uf=ot(["accent","accentunder","align","bevelled","close","columnalign","columnlines","columnspacing","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lquote","lspace","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),yo=ot(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),Um=st(/{{[\w\W]*|^[\w\W]*}}/g),qm=st(/<%[\w\W]*|^[\w\W]*%>/g),$m=st(/\${[\w\W]*/g),Gm=st(/^data-[\-\w.\u00B7-\uFFFF]+$/),Ym=st(/^aria-[\-\w]+$/),ff=st(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),Zm=st(/^(?:\w+script|data):/i),Vm=st(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),Xm=st(/^html$/i),Wm=st(/^[a-z][.\w]*(-[.\w]+)+$/i),df=st(/<[/\w!]/g),hf=st(/<[/\w]/g),Km=st(/<\/no(script|embed|frames)/i),Qm=st(/\/>/i),Nt={element:1,attribute:2,text:3,cdataSection:4,entityReference:5,entityNode:6,processingInstruction:7,comment:8,document:9,documentType:10,documentFragment:11,notation:12},Jm=function(){return typeof window>"u"?null:window},eb=function(e,n){if(typeof e!="object"||typeof e.createPolicy!="function")return null;let r=null;const a="data-tt-policy-suffix";n&&n.hasAttribute(a)&&(r=n.getAttribute(a));const i="dompurify"+(r?"#"+r:"");try{return e.createPolicy(i,{createHTML(s){return s},createScriptURL(s){return s}})}catch{return console.warn("TrustedTypes policy "+i+" could not be created."),null}},pf=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},lr=function(e,n,r,a){return et(e,n)&&cr(e[n])?pe(a.base?bt(a.base):{},e[n],a.transform):r};function gf(){let t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:Jm();const e=O=>gf(O);if(e.version="3.4.12",e.removed=[],!t||!t.document||t.document.nodeType!==Nt.document||!t.Element)return e.isSupported=!1,e;let n=t.document;const r=n,a=r.currentScript;t.DocumentFragment;const i=t.HTMLTemplateElement,s=t.Node,o=t.Element,l=t.NodeFilter,c=t.NamedNodeMap;c===void 0&&(t.NamedNodeMap||t.MozNamedAttrMap),t.HTMLFormElement;const f=t.DOMParser,p=t.trustedTypes,d=o.prototype,m=xn(d,"cloneNode"),g=xn(d,"remove"),v=xn(d,"nextSibling"),w=xn(d,"childNodes"),x=xn(d,"parentNode"),S=xn(d,"shadowRoot"),E=xn(d,"attributes"),R=s&&s.prototype?xn(s.prototype,"nodeType"):null,C=s&&s.prototype?xn(s.prototype,"nodeName"):null;if(typeof i=="function"){const O=n.createElement("template");O.content&&O.content.ownerDocument&&(n=O.content.ownerDocument)}let N,D="",I,F=!1,G=0;const oe=function(){if(G>0)throw Br('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.')},B=function(h){oe(),G++;try{return N.createHTML(h)}finally{G--}},$=function(h){oe(),G++;try{return N.createScriptURL(h)}finally{G--}},Z=function(){return F||(I=eb(p,a),F=!0),I},te=n,se=te.implementation,Ee=te.createNodeIterator,Be=te.createDocumentFragment,U=te.getElementsByTagName,de=r.importNode;let ne=pf();e.isSupported=typeof Qu=="function"&&typeof x=="function"&&se&&se.createHTMLDocument!==void 0;const he=Um,ge=qm,L=$m,V=Gm,Oe=Ym,De=Zm,He=Vm,ut=Wm;let me=ff,W=null;const ft=pe({},[...sf,...Ws,...Ks,...Qs,...cf]);let ve=null;const Sn=pe({},[...lf,...Js,...uf,...yo]);let _e=Object.seal(ha(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),Xe=null,zt=null;const Ie=Object.seal(ha(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}}));let Ft=!0,fn=!0,No=!1,Do=!0,Y=!1,ce=!0,Le=!1,jt=!1,Zn=null,dn=null,Na=!1,mr=!1,Da=!1,Ma=!1,Vn=!0,Yr=!1;const qf="user-content-";let mc=!0,bc=!1,Ba={},Tn=null;const vc=pe({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","selectedcontent","style","svg","template","thead","title","video","xmp"]);let $f=null;const Gf=pe({},["audio","video","img","source","image","track"]);let wc=null;const Yf=pe({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),Mo="http://www.w3.org/1998/Math/MathML",Bo="http://www.w3.org/2000/svg",An="http://www.w3.org/1999/xhtml";let Pa=An,yc=!1,xc=null;const Nv=pe({},[Mo,Bo,An],Xs),Zf=ot(["mi","mo","mn","ms","mtext"]);let _c=pe({},Zf);const Vf=ot(["annotation-xml"]);let kc=pe({},Vf);const Dv=pe({},["title","style","font","a","script"]);let Ii=null;const Mv=["application/xhtml+xml","text/html"],Bv="text/html";let ze=null,za=null;const Pv=n.createElement("form"),Xf=function(h){return h instanceof RegExp||h instanceof Function},Ec=function(){let h=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(za&&za===h)return;(!h||typeof h!="object")&&(h={}),h=bt(h),Ii=Mv.indexOf(h.PARSER_MEDIA_TYPE)===-1?Bv:h.PARSER_MEDIA_TYPE,ze=Ii==="application/xhtml+xml"?Xs:li,W=lr(h,"ALLOWED_TAGS",ft,{transform:ze}),ve=lr(h,"ALLOWED_ATTR",Sn,{transform:ze}),xc=lr(h,"ALLOWED_NAMESPACES",Nv,{transform:Xs}),wc=lr(h,"ADD_URI_SAFE_ATTR",Yf,{transform:ze,base:Yf}),$f=lr(h,"ADD_DATA_URI_TAGS",Gf,{transform:ze,base:Gf}),Tn=lr(h,"FORBID_CONTENTS",vc,{transform:ze}),Xe=lr(h,"FORBID_TAGS",bt({}),{transform:ze}),zt=lr(h,"FORBID_ATTR",bt({}),{transform:ze}),Ba=et(h,"USE_PROFILES")?h.USE_PROFILES&&typeof h.USE_PROFILES=="object"?bt(h.USE_PROFILES):h.USE_PROFILES:!1,Ft=h.ALLOW_ARIA_ATTR!==!1,fn=h.ALLOW_DATA_ATTR!==!1,No=h.ALLOW_UNKNOWN_PROTOCOLS||!1,Do=h.ALLOW_SELF_CLOSE_IN_ATTR!==!1,Y=h.SAFE_FOR_TEMPLATES||!1,ce=h.SAFE_FOR_XML!==!1,Le=h.WHOLE_DOCUMENT||!1,mr=h.RETURN_DOM||!1,Da=h.RETURN_DOM_FRAGMENT||!1,Ma=h.RETURN_TRUSTED_TYPE||!1,Na=h.FORCE_BODY||!1,Vn=h.SANITIZE_DOM!==!1,Yr=h.SANITIZE_NAMED_PROPS||!1,mc=h.KEEP_CONTENT!==!1,bc=h.IN_PLACE||!1,me=Fm(h.ALLOWED_URI_REGEXP)?h.ALLOWED_URI_REGEXP:ff,Pa=typeof h.NAMESPACE=="string"?h.NAMESPACE:An,_c=et(h,"MATHML_TEXT_INTEGRATION_POINTS")&&h.MATHML_TEXT_INTEGRATION_POINTS&&typeof h.MATHML_TEXT_INTEGRATION_POINTS=="object"?bt(h.MATHML_TEXT_INTEGRATION_POINTS):pe({},Zf),kc=et(h,"HTML_INTEGRATION_POINTS")&&h.HTML_INTEGRATION_POINTS&&typeof h.HTML_INTEGRATION_POINTS=="object"?bt(h.HTML_INTEGRATION_POINTS):pe({},Vf);const y=et(h,"CUSTOM_ELEMENT_HANDLING")&&h.CUSTOM_ELEMENT_HANDLING&&typeof h.CUSTOM_ELEMENT_HANDLING=="object"?bt(h.CUSTOM_ELEMENT_HANDLING):ha(null);if(_e=ha(null),et(y,"tagNameCheck")&&Xf(y.tagNameCheck)&&(_e.tagNameCheck=y.tagNameCheck),et(y,"attributeNameCheck")&&Xf(y.attributeNameCheck)&&(_e.attributeNameCheck=y.attributeNameCheck),et(y,"allowCustomizedBuiltInElements")&&typeof y.allowCustomizedBuiltInElements=="boolean"&&(_e.allowCustomizedBuiltInElements=y.allowCustomizedBuiltInElements),st(_e),Y&&(fn=!1),Da&&(mr=!0),Ba&&(W=pe({},cf),ve=ha(null),Ba.html===!0&&(pe(W,sf),pe(ve,lf)),Ba.svg===!0&&(pe(W,Ws),pe(ve,Js),pe(ve,yo)),Ba.svgFilters===!0&&(pe(W,Ks),pe(ve,Js),pe(ve,yo)),Ba.mathMl===!0&&(pe(W,Qs),pe(ve,uf),pe(ve,yo))),Ie.tagCheck=null,Ie.attributeCheck=null,et(h,"ADD_TAGS")&&(typeof h.ADD_TAGS=="function"?Ie.tagCheck=h.ADD_TAGS:cr(h.ADD_TAGS)&&(W===ft&&(W=bt(W)),pe(W,h.ADD_TAGS,ze))),et(h,"ADD_ATTR")&&(typeof h.ADD_ATTR=="function"?Ie.attributeCheck=h.ADD_ATTR:cr(h.ADD_ATTR)&&(ve===Sn&&(ve=bt(ve)),pe(ve,h.ADD_ATTR,ze))),et(h,"ADD_URI_SAFE_ATTR")&&cr(h.ADD_URI_SAFE_ATTR)&&pe(wc,h.ADD_URI_SAFE_ATTR,ze),et(h,"FORBID_CONTENTS")&&cr(h.FORBID_CONTENTS)&&(Tn===vc&&(Tn=bt(Tn)),pe(Tn,h.FORBID_CONTENTS,ze)),et(h,"ADD_FORBID_CONTENTS")&&cr(h.ADD_FORBID_CONTENTS)&&(Tn===vc&&(Tn=bt(Tn)),pe(Tn,h.ADD_FORBID_CONTENTS,ze)),mc&&(W["#text"]=!0),Le&&pe(W,["html","head","body"]),W.table&&(pe(W,["tbody"]),delete Xe.tbody),h.TRUSTED_TYPES_POLICY){if(typeof h.TRUSTED_TYPES_POLICY.createHTML!="function")throw Br('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof h.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw Br('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');const A=N;N=h.TRUSTED_TYPES_POLICY;try{D=B("")}catch(q){throw N=A,q}}else h.TRUSTED_TYPES_POLICY===null?(N=void 0,D=""):(N===void 0&&(N=Z()),N&&typeof D=="string"&&(D=B("")));ot&&ot(h),za=h},Wf=pe({},[...Ws,...Ks,...jm]),Kf=pe({},[...Qs,...Hm]),zv=function(h,y,A){return y.namespaceURI===An?h==="svg":y.namespaceURI===Mo?h==="svg"&&(A==="annotation-xml"||_c[A]):!!Wf[h]},Fv=function(h,y,A){return y.namespaceURI===An?h==="math":y.namespaceURI===Bo?h==="math"&&kc[A]:!!Kf[h]},jv=function(h,y,A){return y.namespaceURI===Bo&&!kc[A]||y.namespaceURI===Mo&&!_c[A]?!1:!Kf[h]&&(Dv[h]||!Wf[h])},Hv=function(h){let y=x(h);(!y||!y.tagName)&&(y={namespaceURI:Pa,tagName:"template"});const A=li(h.tagName),q=li(y.tagName);return xc[h.namespaceURI]?h.namespaceURI===Bo?zv(A,y,q):h.namespaceURI===Mo?Fv(A,y,q):h.namespaceURI===An?jv(A,y,q):!!(Ii==="application/xhtml+xml"&&xc[h.namespaceURI]):!1},br=function(h){ga(e.removed,{element:h});try{x(h).removeChild(h)}catch{if(g(h),!x(h))throw Br("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place")}},Po=function(h){Sc(h);const y=w(h);if(y){const q=[];pa(y,K=>{ga(q,K)}),pa(q,K=>{try{g(K)}catch{}})}const A=E(h);if(A)for(let q=A.length-1;q>=0;--q){const K=A[q],J=K&&K.name;if(typeof J=="string")try{h.removeAttribute(J)}catch{}}},Zr=function(h,y){try{ga(e.removed,{attribute:y.getAttributeNode(h),from:y})}catch{ga(e.removed,{attribute:null,from:y})}if(y.removeAttribute(h),h==="is")if(mr||Da)try{br(y)}catch{}else try{y.setAttribute(h,"")}catch{}},Uv=function(h){const y=E(h);if(y)for(let A=y.length-1;A>=0;--A){const q=y[A],K=q&&q.name;if(!(typeof K!="string"||ve[ze(K)]))try{h.removeAttribute(K)}catch{}}},Sc=function(h){const y=[h];for(;y.length>0;){const A=y.pop();(R?R(A):A.nodeType)===Nt.element&&Uv(A);const K=w(A);if(K)for(let J=K.length-1;J>=0;--J)y.push(K[J])}},qv=function(h){if(!ce)return;const y=[h];for(;y.length>0;){const A=y.pop(),q=R?R(A):A.nodeType;if(q===Nt.processingInstruction||q===Nt.comment&&tt(hf,A.data)){try{g(A)}catch{}continue}if(q===Nt.element){const J=A,Ue=ze(C?C(A):A.nodeName);try{J.hasAttribute&&J.hasAttribute("patchsrc")&&J.removeAttribute("patchsrc"),J.hasAttribute&&J.hasAttribute("for")&&Ue!=="label"&&Ue!=="output"&&J.removeAttribute("for")}catch{}}const K=w(A);if(K)for(let J=K.length-1;J>=0;--J)y.push(K[J])}},Qf=function(h){let y=null,A=null;if(Na)h="<remove></remove>"+h;else{const J=nf(h,/^[\r\n\t ]+/);A=J&&J[0]}Ii==="application/xhtml+xml"&&Pa===An&&(h='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+h+"</body></html>");const q=N?B(h):h;if(Pa===An)try{y=new f().parseFromString(q,Ii)}catch{}if(!y||!y.documentElement){y=se.createDocument(Pa,"template",null);try{y.documentElement.innerHTML=yc?D:q}catch{}}const K=y.body||y.documentElement;return h&&A&&K.insertBefore(n.createTextNode(A),K.childNodes[0]||null),Pa===An?U.call(y,Le?"html":"body")[0]:Le?y.documentElement:K},Jf=function(h){return Ee.call(h.ownerDocument||h,h,l.SHOW_ELEMENT|l.SHOW_COMMENT|l.SHOW_TEXT|l.SHOW_PROCESSING_INSTRUCTION|l.SHOW_CDATA_SECTION,null)},zo=function(h){return h=ui(h,he," "),h=ui(h,ge," "),h=ui(h,L," "),h},Tc=function(h){var y;h.normalize();const A=Ee.call(h.ownerDocument||h,h,l.SHOW_TEXT|l.SHOW_COMMENT|l.SHOW_CDATA_SECTION|l.SHOW_PROCESSING_INSTRUCTION,null);let q=A.nextNode();for(;q;)q.data=zo(q.data),q=A.nextNode();const K=(y=h.querySelectorAll)===null||y===void 0?void 0:y.call(h,"template");K&&pa(K,J=>{Fa(J.content)&&Tc(J.content)})},Fo=function(h){const y=C?C(h):null;return typeof y!="string"||ze(y)!=="form"?!1:typeof h.nodeName!="string"||typeof h.textContent!="string"||typeof h.removeChild!="function"||h.attributes!==E(h)||typeof h.removeAttribute!="function"||typeof h.setAttribute!="function"||typeof h.namespaceURI!="string"||typeof h.insertBefore!="function"||typeof h.hasChildNodes!="function"||h.nodeType!==R(h)||h.childNodes!==w(h)},Fa=function(h){if(!R||typeof h!="object"||h===null)return!1;try{return R(h)===Nt.documentFragment}catch{return!1}},Oi=function(h){if(!R||typeof h!="object"||h===null)return!1;try{return typeof R(h)=="number"}catch{return!1}};function Rn(O,h,y){O.length!==0&&pa(O,A=>{A.call(e,h,y,za)})}const $v=function(h,y){return!!(ce&&h.hasChildNodes()&&!Oi(h.firstElementChild)&&tt(df,h.textContent)&&tt(df,h.innerHTML)||ce&&h.namespaceURI===An&&y==="style"&&Oi(h.firstElementChild)||h.nodeType===Nt.processingInstruction||ce&&h.nodeType===Nt.comment&&tt(hf,h.data))},Gv=function(h,y){if(!Xe[y]&&nd(y)&&(_e.tagNameCheck instanceof RegExp&&tt(_e.tagNameCheck,y)||_e.tagNameCheck instanceof Function&&_e.tagNameCheck(y)))return!1;if(mc&&!Tn[y]){const A=x(h),q=w(h);if(q&&A){const K=q.length;for(let J=K-1;J>=0;--J){const Ue=bc?q[J]:m(q[J],!0);A.insertBefore(Ue,v(h))}}}return br(h),!0},ed=function(h,y){if(Rn(ne.beforeSanitizeElements,h,null),h!==y&&x(h)===null)return!0;if(Fo(h))return br(h),!0;const A=ze(C?C(h):h.nodeName);if(Rn(ne.uponSanitizeElement,h,{tagName:A,allowedTags:W}),h!==y&&x(h)===null)return!0;if($v(h,A))return br(h),!0;if(Xe[A]||!(Ie.tagCheck instanceof Function&&Ie.tagCheck(A))&&!W[A]){const K=Gv(h,A);return K===!1&&Rn(ne.afterSanitizeElements,h,null),K}if((R?R(h):h.nodeType)===Nt.element&&!Hv(h)||(A==="noscript"||A==="noembed"||A==="noframes")&&tt(Km,h.innerHTML))return br(h),!0;if(Y&&h.nodeType===Nt.text){const K=zo(h.textContent);h.textContent!==K&&(ga(e.removed,{element:h.cloneNode()}),h.textContent=K)}return Rn(ne.afterSanitizeElements,h,null),!1},td=function(h,y,A){if(zt[y]||ce&&y==="patchsrc"||ce&&y==="for"&&h!=="label"&&h!=="output"||Vn&&(y==="id"||y==="name")&&(A in n||A in Pv))return!1;const q=ve[y]||Ie.attributeCheck instanceof Function&&Ie.attributeCheck(y,h);if(!(fn&&tt(V,y))){if(!(Ft&&tt(Oe,y))){if(q){if(!wc[y]){if(!tt(me,ui(A,He,""))){if(!((y==="src"||y==="xlink:href"||y==="href")&&h!=="script"&&rf(A,"data:")===0&&$f[h])){if(!(No&&!tt(De,ui(A,He,"")))){if(A)return!1}}}}}else if(!(nd(h)&&(_e.tagNameCheck instanceof RegExp&&tt(_e.tagNameCheck,h)||_e.tagNameCheck instanceof Function&&_e.tagNameCheck(h))&&(_e.attributeNameCheck instanceof RegExp&&tt(_e.attributeNameCheck,y)||_e.attributeNameCheck instanceof Function&&_e.attributeNameCheck(y,h))||y==="is"&&_e.allowCustomizedBuiltInElements&&(_e.tagNameCheck instanceof RegExp&&tt(_e.tagNameCheck,A)||_e.tagNameCheck instanceof Function&&_e.tagNameCheck(A))))return!1}}return!0},Yv=pe({},["annotation-xml","color-profile","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","missing-glyph"]),nd=function(h){return!Yv[li(h)]&&tt(ut,h)},Zv=function(h,y,A,q){if(N&&typeof p=="object"&&typeof p.getAttributeType=="function"&&!A)switch(p.getAttributeType(h,y)){case"TrustedHTML":return B(q);case"TrustedScriptURL":return $(q)}return q},Vv=function(h,y,A,q){try{A?h.setAttributeNS(A,y,q):h.setAttribute(y,q),Fo(h)?br(h):tf(e.removed)}catch{Zr(y,h)}},rd=function(h){Rn(ne.beforeSanitizeAttributes,h,null);const y=h.attributes;if(!y||Fo(h))return;const A={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:ve,forceKeepAttr:void 0};let q=y.length;const K=ze(h.nodeName);for(;q--;){const J=y[q],Ue=J.name,dt=J.namespaceURI,hn=J.value,Ct=ze(Ue),pn=hn;let xt=Ue==="value"?pn:Nm(pn);if(A.attrName=Ct,A.attrValue=xt,A.keepAttr=!0,A.forceKeepAttr=void 0,Rn(ne.uponSanitizeAttribute,h,A),xt=A.attrValue,Yr&&(Ct==="id"||Ct==="name")&&rf(xt,qf)!==0&&(Zr(Ue,h),xt=qf+xt),ce&&tt(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,xt)){Zr(Ue,h);continue}if(Ct==="attributename"&&nf(xt,"href")){Zr(Ue,h);continue}if(!A.forceKeepAttr){if(!A.keepAttr){Zr(Ue,h);continue}if(!Do&&tt(Qm,xt)){Zr(Ue,h);continue}if(Y&&(xt=zo(xt)),!td(K,Ct,xt)){Zr(Ue,h);continue}xt=Zv(K,Ct,dt,xt),xt!==pn&&Vv(h,Ue,dt,xt)}}Rn(ne.afterSanitizeAttributes,h,null)},jo=function(h){let y=null;const A=Jf(h);for(Rn(ne.beforeSanitizeShadowDOM,h,null);y=A.nextNode();)if(Rn(ne.uponSanitizeShadowNode,y,null),ed(y,h),rd(y),Fa(y.content)&&jo(y.content),(R?R(y):y.nodeType)===Nt.element){const K=S(y);Fa(K)&&(Ac(K),jo(K))}Rn(ne.afterSanitizeShadowDOM,h,null)},Ac=function(h){const y=[{node:h,shadow:null}];for(;y.length>0;){const A=y.pop();if(A.shadow){jo(A.shadow);continue}const q=A.node,J=(R?R(q):q.nodeType)===Nt.element,Ue=w(q);if(Ue)for(let dt=Ue.length-1;dt>=0;--dt)y.push({node:Ue[dt],shadow:null});if(J){const dt=C?C(q):null;if(typeof dt=="string"&&ze(dt)==="template"){const hn=q.content;Fa(hn)&&y.push({node:hn,shadow:null})}}if(J){const dt=S(q);Fa(dt)&&y.push({node:null,shadow:dt},{node:dt,shadow:null})}}};return e.sanitize=function(O){let h=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},y=null,A=null,q=null,K=null;if(yc=!O,yc&&(O="<!-->"),typeof O!="string"&&!Oi(O)&&(O=zm(O),typeof O!="string"))throw Br("dirty is not a string, aborting");if(!e.isSupported)return O;jt?(W=Zn,ve=dn):Ec(h),(ne.uponSanitizeElement.length>0||ne.uponSanitizeAttribute.length>0)&&(W=bt(W)),ne.uponSanitizeAttribute.length>0&&(ve=bt(ve)),e.removed=[];const J=bc&&typeof O!="string"&&Oi(O);if(J){qv(O);const Ct=C?C(O):O.nodeName;if(typeof Ct=="string"){const pn=ze(Ct);if(!W[pn]||Xe[pn])throw Po(O),Br("root node is forbidden and cannot be sanitized in-place")}if(Fo(O))throw Po(O),Br("root node is clobbered and cannot be sanitized in-place");try{Ac(O)}catch(pn){throw Po(O),pn}}else if(Oi(O))y=Qf("<!---->"),A=y.ownerDocument.importNode(O,!0),A.nodeType===Nt.element&&A.nodeName==="BODY"||A.nodeName==="HTML"?y=A:y.appendChild(A),Ac(A);else{if(!mr&&!Y&&!Le&&O.indexOf("<")===-1)return N&&Ma?B(O):O;if(y=Qf(O),!y)return mr?null:Ma?D:""}y&&Na&&br(y.firstChild);const Ue=J?O:y,dt=Jf(Ue);try{for(;q=dt.nextNode();)ed(q,Ue),rd(q),Fa(q.content)&&jo(q.content)}catch(Ct){throw J&&(Po(O),pa(e.removed,pn=>{pn.element&&Sc(pn.element)})),Ct}if(J)return pa(e.removed,Ct=>{Ct.element&&Sc(Ct.element)}),Y&&Tc(O),O;if(mr){if(Y&&Tc(y),Da)for(K=Be.call(y.ownerDocument);y.firstChild;)K.appendChild(y.firstChild);else K=y;return(ve.shadowroot||ve.shadowrootmode)&&(K=de.call(r,K,!0)),K}let hn=Le?y.outerHTML:y.innerHTML;return Le&&W["!doctype"]&&y.ownerDocument&&y.ownerDocument.doctype&&y.ownerDocument.doctype.name&&tt(Xm,y.ownerDocument.doctype.name)&&(hn="<!DOCTYPE "+y.ownerDocument.doctype.name+`>
`+hn),Y&&(hn=zo(hn)),N&&Ma?B(hn):hn},e.setConfig=function(){let O=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};Ec(O),jt=!0,Zn=W,dn=ve},e.clearConfig=function(){za=null,jt=!1,Zn=null,dn=null,N=I,D=""},e.isValidAttribute=function(O,h,y){za||Ec({});const A=ze(O),q=ze(h);return td(A,q,y)},e.addHook=function(O,h){typeof h=="function"&&et(ne,O)&&ga(ne[O],h)},e.removeHook=function(O,h){if(et(ne,O)){if(h!==void 0){const y=Om(ne[O],h);return y===-1?void 0:Lm(ne[O],y,1)[0]}return tf(ne[O])}},e.removeHooks=function(O){et(ne,O)&&(ne[O]=[])},e.removeAllHooks=function(){ne=pf()},e}var tb=gf();function ec(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var Pr=ec();function mf(t){Pr=t}var di={exec:()=>null};function ke(t,e=""){let n=typeof t=="string"?t:t.source;const r={replace:(a,i)=>{let s=typeof i=="string"?i:i.source;return s=s.replace(vt.caret,"$1"),n=n.replace(a,s),r},getRegex:()=>new RegExp(n,e)};return r}var vt={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] /,listReplaceTask:/^\[[ xX]\] +/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:t=>new RegExp(`^( {0,3}${t})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}#`),htmlBeginRegex:t=>new RegExp(`^ {0,${Math.min(3,t-1)}}<(?:[a-z].*>|!--)`,"i")},nb=/^(?:[ \t]*(?:\n|$))+/,rb=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,ab=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,hi=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,ib=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,tc=/(?:[*+-]|\d{1,9}[.)])/,bf=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,vf=ke(bf).replace(/bull/g,tc).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),ob=ke(bf).replace(/bull/g,tc).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),nc=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,sb=/^[^\n]+/,rc=/(?!\s*\])(?:\\.|[^\[\]\\])+/,cb=ke(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",rc).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),lb=ke(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,tc).getRegex(),xo="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",ac=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,ub=ke("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",ac).replace("tag",xo).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),wf=ke(nc).replace("hr",hi).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",xo).getRegex(),fb=ke(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",wf).getRegex(),ic={blockquote:fb,code:rb,def:cb,fences:ab,heading:ib,hr:hi,html:ub,lheading:vf,list:lb,newline:nb,paragraph:wf,table:di,text:sb},yf=ke("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",hi).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",xo).getRegex(),db={...ic,lheading:ob,table:yf,paragraph:ke(nc).replace("hr",hi).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",yf).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",xo).getRegex()},hb={...ic,html:ke(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",ac).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:di,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:ke(nc).replace("hr",hi).replace("heading",` *#{1,6} *[^
]`).replace("lheading",vf).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},pb=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,gb=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,xf=/^( {2,}|\\)\n(?!\s*$)/,mb=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,_o=/[\p{P}\p{S}]/u,oc=/[\s\p{P}\p{S}]/u,_f=/[^\s\p{P}\p{S}]/u,bb=ke(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,oc).getRegex(),kf=/(?!~)[\p{P}\p{S}]/u,vb=/(?!~)[\s\p{P}\p{S}]/u,wb=/(?:[^\s\p{P}\p{S}]|~)/u,yb=/\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g,Ef=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,xb=ke(Ef,"u").replace(/punct/g,_o).getRegex(),_b=ke(Ef,"u").replace(/punct/g,kf).getRegex(),Sf="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",kb=ke(Sf,"gu").replace(/notPunctSpace/g,_f).replace(/punctSpace/g,oc).replace(/punct/g,_o).getRegex(),Eb=ke(Sf,"gu").replace(/notPunctSpace/g,wb).replace(/punctSpace/g,vb).replace(/punct/g,kf).getRegex(),Sb=ke("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,_f).replace(/punctSpace/g,oc).replace(/punct/g,_o).getRegex(),Tb=ke(/\\(punct)/,"gu").replace(/punct/g,_o).getRegex(),Ab=ke(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),Rb=ke(ac).replace("(?:-->|$)","-->").getRegex(),Cb=ke("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",Rb).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),ko=/(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,Ib=ke(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label",ko).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),Tf=ke(/^!?\[(label)\]\[(ref)\]/).replace("label",ko).replace("ref",rc).getRegex(),Af=ke(/^!?\[(ref)\](?:\[\])?/).replace("ref",rc).getRegex(),Ob=ke("reflink|nolink(?!\\()","g").replace("reflink",Tf).replace("nolink",Af).getRegex(),sc={_backpedal:di,anyPunctuation:Tb,autolink:Ab,blockSkip:yb,br:xf,code:gb,del:di,emStrongLDelim:xb,emStrongRDelimAst:kb,emStrongRDelimUnd:Sb,escape:pb,link:Ib,nolink:Af,punctuation:bb,reflink:Tf,reflinkSearch:Ob,tag:Cb,text:mb,url:di},Lb={...sc,link:ke(/^!?\[(label)\]\((.*?)\)/).replace("label",ko).getRegex(),reflink:ke(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",ko).getRegex()},cc={...sc,emStrongRDelimAst:Eb,emStrongLDelim:_b,url:ke(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,"i").replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/},Nb={...cc,br:ke(xf).replace("{2,}","*").getRegex(),text:ke(cc.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},Eo={normal:ic,gfm:db,pedantic:hb},pi={normal:sc,gfm:cc,breaks:Nb,pedantic:Lb},Db={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},Rf=t=>Db[t];function _n(t,e){if(e){if(vt.escapeTest.test(t))return t.replace(vt.escapeReplace,Rf)}else if(vt.escapeTestNoEncode.test(t))return t.replace(vt.escapeReplaceNoEncode,Rf);return t}function Cf(t){try{t=encodeURI(t).replace(vt.percentDecode,"%")}catch{return null}return t}function If(t,e){var i;const n=t.replace(vt.findPipe,(s,o,l)=>{let c=!1,f=o;for(;--f>=0&&l[f]==="\\";)c=!c;return c?"|":" |"}),r=n.split(vt.splitPipe);let a=0;if(r[0].trim()||r.shift(),r.length>0&&!((i=r.at(-1))!=null&&i.trim())&&r.pop(),e)if(r.length>e)r.splice(e);else for(;r.length<e;)r.push("");for(;a<r.length;a++)r[a]=r[a].trim().replace(vt.slashPipe,"|");return r}function gi(t,e,n){const r=t.length;if(r===0)return"";let a=0;for(;a<r&&t.charAt(r-a-1)===e;)a++;return t.slice(0,r-a)}function Mb(t,e){if(t.indexOf(e[1])===-1)return-1;let n=0;for(let r=0;r<t.length;r++)if(t[r]==="\\")r++;else if(t[r]===e[0])n++;else if(t[r]===e[1]&&(n--,n<0))return r;return n>0?-2:-1}function Of(t,e,n,r,a){const i=e.href,s=e.title||null,o=t[1].replace(a.other.outputLinkReplace,"$1");r.state.inLink=!0;const l={type:t[0].charAt(0)==="!"?"image":"link",raw:n,href:i,title:s,text:o,tokens:r.inlineTokens(o)};return r.state.inLink=!1,l}function Bb(t,e,n){const r=t.match(n.other.indentCodeCompensation);if(r===null)return e;const a=r[1];return e.split(`
`).map(i=>{const s=i.match(n.other.beginningSpace);if(s===null)return i;const[o]=s;return o.length>=a.length?i.slice(a.length):i}).join(`
`)}var So=class{constructor(t){k(this,"options");k(this,"rules");k(this,"lexer");this.options=t||Pr}space(t){const e=this.rules.block.newline.exec(t);if(e&&e[0].length>0)return{type:"space",raw:e[0]}}code(t){const e=this.rules.block.code.exec(t);if(e){const n=e[0].replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:e[0],codeBlockStyle:"indented",text:this.options.pedantic?n:gi(n,`
`)}}}fences(t){const e=this.rules.block.fences.exec(t);if(e){const n=e[0],r=Bb(n,e[3]||"",this.rules);return{type:"code",raw:n,lang:e[2]?e[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):e[2],text:r}}}heading(t){const e=this.rules.block.heading.exec(t);if(e){let n=e[2].trim();if(this.rules.other.endingHash.test(n)){const r=gi(n,"#");(this.options.pedantic||!r||this.rules.other.endingSpaceChar.test(r))&&(n=r.trim())}return{type:"heading",raw:e[0],depth:e[1].length,text:n,tokens:this.lexer.inline(n)}}}hr(t){const e=this.rules.block.hr.exec(t);if(e)return{type:"hr",raw:gi(e[0],`
`)}}blockquote(t){const e=this.rules.block.blockquote.exec(t);if(e){let n=gi(e[0],`
`).split(`
`),r="",a="";const i=[];for(;n.length>0;){let s=!1;const o=[];let l;for(l=0;l<n.length;l++)if(this.rules.other.blockquoteStart.test(n[l]))o.push(n[l]),s=!0;else if(!s)o.push(n[l]);else break;n=n.slice(l);const c=o.join(`
`),f=c.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");r=r?`${r}
${c}`:c,a=a?`${a}
${f}`:f;const p=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(f,i,!0),this.lexer.state.top=p,n.length===0)break;const d=i.at(-1);if((d==null?void 0:d.type)==="code")break;if((d==null?void 0:d.type)==="blockquote"){const m=d,g=m.raw+`
`+n.join(`
`),v=this.blockquote(g);i[i.length-1]=v,r=r.substring(0,r.length-m.raw.length)+v.raw,a=a.substring(0,a.length-m.text.length)+v.text;break}else if((d==null?void 0:d.type)==="list"){const m=d,g=m.raw+`
`+n.join(`
`),v=this.list(g);i[i.length-1]=v,r=r.substring(0,r.length-d.raw.length)+v.raw,a=a.substring(0,a.length-m.raw.length)+v.raw,n=g.substring(i.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:r,tokens:i,text:a}}}list(t){let e=this.rules.block.list.exec(t);if(e){let n=e[1].trim();const r=n.length>1,a={type:"list",raw:"",ordered:r,start:r?+n.slice(0,-1):"",loose:!1,items:[]};n=r?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=r?n:"[*+-]");const i=this.rules.other.listItemRegex(n);let s=!1;for(;t;){let l=!1,c="",f="";if(!(e=i.exec(t))||this.rules.block.hr.test(t))break;c=e[0],t=t.substring(c.length);let p=e[2].split(`
`,1)[0].replace(this.rules.other.listReplaceTabs,x=>" ".repeat(3*x.length)),d=t.split(`
`,1)[0],m=!p.trim(),g=0;if(this.options.pedantic?(g=2,f=p.trimStart()):m?g=e[1].length+1:(g=e[2].search(this.rules.other.nonSpaceChar),g=g>4?1:g,f=p.slice(g),g+=e[1].length),m&&this.rules.other.blankLine.test(d)&&(c+=d+`
`,t=t.substring(d.length+1),l=!0),!l){const x=this.rules.other.nextBulletRegex(g),S=this.rules.other.hrRegex(g),E=this.rules.other.fencesBeginRegex(g),R=this.rules.other.headingBeginRegex(g),C=this.rules.other.htmlBeginRegex(g);for(;t;){const N=t.split(`
`,1)[0];let D;if(d=N,this.options.pedantic?(d=d.replace(this.rules.other.listReplaceNesting,"  "),D=d):D=d.replace(this.rules.other.tabCharGlobal,"    "),E.test(d)||R.test(d)||C.test(d)||x.test(d)||S.test(d))break;if(D.search(this.rules.other.nonSpaceChar)>=g||!d.trim())f+=`
`+D.slice(g);else{if(m||p.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||E.test(p)||R.test(p)||S.test(p))break;f+=`
`+d}!m&&!d.trim()&&(m=!0),c+=N+`
`,t=t.substring(N.length+1),p=D.slice(g)}}a.loose||(s?a.loose=!0:this.rules.other.doubleBlankLine.test(c)&&(s=!0));let v=null,w;this.options.gfm&&(v=this.rules.other.listIsTask.exec(f),v&&(w=v[0]!=="[ ] ",f=f.replace(this.rules.other.listReplaceTask,""))),a.items.push({type:"list_item",raw:c,task:!!v,checked:w,loose:!1,text:f,tokens:[]}),a.raw+=c}const o=a.items.at(-1);if(o)o.raw=o.raw.trimEnd(),o.text=o.text.trimEnd();else return;a.raw=a.raw.trimEnd();for(let l=0;l<a.items.length;l++)if(this.lexer.state.top=!1,a.items[l].tokens=this.lexer.blockTokens(a.items[l].text,[]),!a.loose){const c=a.items[l].tokens.filter(p=>p.type==="space"),f=c.length>0&&c.some(p=>this.rules.other.anyLine.test(p.raw));a.loose=f}if(a.loose)for(let l=0;l<a.items.length;l++)a.items[l].loose=!0;return a}}html(t){const e=this.rules.block.html.exec(t);if(e)return{type:"html",block:!0,raw:e[0],pre:e[1]==="pre"||e[1]==="script"||e[1]==="style",text:e[0]}}def(t){const e=this.rules.block.def.exec(t);if(e){const n=e[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),r=e[2]?e[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",a=e[3]?e[3].substring(1,e[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):e[3];return{type:"def",tag:n,raw:e[0],href:r,title:a}}}table(t){var s;const e=this.rules.block.table.exec(t);if(!e||!this.rules.other.tableDelimiter.test(e[2]))return;const n=If(e[1]),r=e[2].replace(this.rules.other.tableAlignChars,"").split("|"),a=(s=e[3])!=null&&s.trim()?e[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],i={type:"table",raw:e[0],header:[],align:[],rows:[]};if(n.length===r.length){for(const o of r)this.rules.other.tableAlignRight.test(o)?i.align.push("right"):this.rules.other.tableAlignCenter.test(o)?i.align.push("center"):this.rules.other.tableAlignLeft.test(o)?i.align.push("left"):i.align.push(null);for(let o=0;o<n.length;o++)i.header.push({text:n[o],tokens:this.lexer.inline(n[o]),header:!0,align:i.align[o]});for(const o of a)i.rows.push(If(o,i.header.length).map((l,c)=>({text:l,tokens:this.lexer.inline(l),header:!1,align:i.align[c]})));return i}}lheading(t){const e=this.rules.block.lheading.exec(t);if(e)return{type:"heading",raw:e[0],depth:e[2].charAt(0)==="="?1:2,text:e[1],tokens:this.lexer.inline(e[1])}}paragraph(t){const e=this.rules.block.paragraph.exec(t);if(e){const n=e[1].charAt(e[1].length-1)===`
`?e[1].slice(0,-1):e[1];return{type:"paragraph",raw:e[0],text:n,tokens:this.lexer.inline(n)}}}text(t){const e=this.rules.block.text.exec(t);if(e)return{type:"text",raw:e[0],text:e[0],tokens:this.lexer.inline(e[0])}}escape(t){const e=this.rules.inline.escape.exec(t);if(e)return{type:"escape",raw:e[0],text:e[1]}}tag(t){const e=this.rules.inline.tag.exec(t);if(e)return!this.lexer.state.inLink&&this.rules.other.startATag.test(e[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(e[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(e[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(e[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:e[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:e[0]}}link(t){const e=this.rules.inline.link.exec(t);if(e){const n=e[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(n)){if(!this.rules.other.endAngleBracket.test(n))return;const i=gi(n.slice(0,-1),"\\");if((n.length-i.length)%2===0)return}else{const i=Mb(e[2],"()");if(i===-2)return;if(i>-1){const o=(e[0].indexOf("!")===0?5:4)+e[1].length+i;e[2]=e[2].substring(0,i),e[0]=e[0].substring(0,o).trim(),e[3]=""}}let r=e[2],a="";if(this.options.pedantic){const i=this.rules.other.pedanticHrefTitle.exec(r);i&&(r=i[1],a=i[3])}else a=e[3]?e[3].slice(1,-1):"";return r=r.trim(),this.rules.other.startAngleBracket.test(r)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(n)?r=r.slice(1):r=r.slice(1,-1)),Of(e,{href:r&&r.replace(this.rules.inline.anyPunctuation,"$1"),title:a&&a.replace(this.rules.inline.anyPunctuation,"$1")},e[0],this.lexer,this.rules)}}reflink(t,e){let n;if((n=this.rules.inline.reflink.exec(t))||(n=this.rules.inline.nolink.exec(t))){const r=(n[2]||n[1]).replace(this.rules.other.multipleSpaceGlobal," "),a=e[r.toLowerCase()];if(!a){const i=n[0].charAt(0);return{type:"text",raw:i,text:i}}return Of(n,a,n[0],this.lexer,this.rules)}}emStrong(t,e,n=""){let r=this.rules.inline.emStrongLDelim.exec(t);if(!r||r[3]&&n.match(this.rules.other.unicodeAlphaNumeric))return;if(!(r[1]||r[2]||"")||!n||this.rules.inline.punctuation.exec(n)){const i=[...r[0]].length-1;let s,o,l=i,c=0;const f=r[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(f.lastIndex=0,e=e.slice(-1*t.length+i);(r=f.exec(e))!=null;){if(s=r[1]||r[2]||r[3]||r[4]||r[5]||r[6],!s)continue;if(o=[...s].length,r[3]||r[4]){l+=o;continue}else if((r[5]||r[6])&&i%3&&!((i+o)%3)){c+=o;continue}if(l-=o,l>0)continue;o=Math.min(o,o+l+c);const p=[...r[0]][0].length,d=t.slice(0,i+r.index+p+o);if(Math.min(i,o)%2){const g=d.slice(1,-1);return{type:"em",raw:d,text:g,tokens:this.lexer.inlineTokens(g)}}const m=d.slice(2,-2);return{type:"strong",raw:d,text:m,tokens:this.lexer.inlineTokens(m)}}}}codespan(t){const e=this.rules.inline.code.exec(t);if(e){let n=e[2].replace(this.rules.other.newLineCharGlobal," ");const r=this.rules.other.nonSpaceChar.test(n),a=this.rules.other.startingSpaceChar.test(n)&&this.rules.other.endingSpaceChar.test(n);return r&&a&&(n=n.substring(1,n.length-1)),{type:"codespan",raw:e[0],text:n}}}br(t){const e=this.rules.inline.br.exec(t);if(e)return{type:"br",raw:e[0]}}del(t){const e=this.rules.inline.del.exec(t);if(e)return{type:"del",raw:e[0],text:e[2],tokens:this.lexer.inlineTokens(e[2])}}autolink(t){const e=this.rules.inline.autolink.exec(t);if(e){let n,r;return e[2]==="@"?(n=e[1],r="mailto:"+n):(n=e[1],r=n),{type:"link",raw:e[0],text:n,href:r,tokens:[{type:"text",raw:n,text:n}]}}}url(t){var n;let e;if(e=this.rules.inline.url.exec(t)){let r,a;if(e[2]==="@")r=e[0],a="mailto:"+r;else{let i;do i=e[0],e[0]=((n=this.rules.inline._backpedal.exec(e[0]))==null?void 0:n[0])??"";while(i!==e[0]);r=e[0],e[1]==="www."?a="http://"+e[0]:a=e[0]}return{type:"link",raw:e[0],text:r,href:a,tokens:[{type:"text",raw:r,text:r}]}}}inlineText(t){const e=this.rules.inline.text.exec(t);if(e){const n=this.lexer.state.inRawBlock;return{type:"text",raw:e[0],text:e[0],escaped:n}}}},Fn=class jc{constructor(e){k(this,"tokens");k(this,"options");k(this,"state");k(this,"tokenizer");k(this,"inlineQueue");this.tokens=[],this.tokens.links=Object.create(null),this.options=e||Pr,this.options.tokenizer=this.options.tokenizer||new So,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};const n={other:vt,block:Eo.normal,inline:pi.normal};this.options.pedantic?(n.block=Eo.pedantic,n.inline=pi.pedantic):this.options.gfm&&(n.block=Eo.gfm,this.options.breaks?n.inline=pi.breaks:n.inline=pi.gfm),this.tokenizer.rules=n}static get rules(){return{block:Eo,inline:pi}}static lex(e,n){return new jc(n).lex(e)}static lexInline(e,n){return new jc(n).inlineTokens(e)}lex(e){e=e.replace(vt.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let n=0;n<this.inlineQueue.length;n++){const r=this.inlineQueue[n];this.inlineTokens(r.src,r.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,n=[],r=!1){var a,i,s;for(this.options.pedantic&&(e=e.replace(vt.tabCharGlobal,"    ").replace(vt.spaceLine,""));e;){let o;if((i=(a=this.options.extensions)==null?void 0:a.block)!=null&&i.some(c=>(o=c.call({lexer:this},e,n))?(e=e.substring(o.raw.length),n.push(o),!0):!1))continue;if(o=this.tokenizer.space(e)){e=e.substring(o.raw.length);const c=n.at(-1);o.raw.length===1&&c!==void 0?c.raw+=`
`:n.push(o);continue}if(o=this.tokenizer.code(e)){e=e.substring(o.raw.length);const c=n.at(-1);(c==null?void 0:c.type)==="paragraph"||(c==null?void 0:c.type)==="text"?(c.raw+=`
`+o.raw,c.text+=`
`+o.text,this.inlineQueue.at(-1).src=c.text):n.push(o);continue}if(o=this.tokenizer.fences(e)){e=e.substring(o.raw.length),n.push(o);continue}if(o=this.tokenizer.heading(e)){e=e.substring(o.raw.length),n.push(o);continue}if(o=this.tokenizer.hr(e)){e=e.substring(o.raw.length),n.push(o);continue}if(o=this.tokenizer.blockquote(e)){e=e.substring(o.raw.length),n.push(o);continue}if(o=this.tokenizer.list(e)){e=e.substring(o.raw.length),n.push(o);continue}if(o=this.tokenizer.html(e)){e=e.substring(o.raw.length),n.push(o);continue}if(o=this.tokenizer.def(e)){e=e.substring(o.raw.length);const c=n.at(-1);(c==null?void 0:c.type)==="paragraph"||(c==null?void 0:c.type)==="text"?(c.raw+=`
`+o.raw,c.text+=`
`+o.raw,this.inlineQueue.at(-1).src=c.text):this.tokens.links[o.tag]||(this.tokens.links[o.tag]={href:o.href,title:o.title});continue}if(o=this.tokenizer.table(e)){e=e.substring(o.raw.length),n.push(o);continue}if(o=this.tokenizer.lheading(e)){e=e.substring(o.raw.length),n.push(o);continue}let l=e;if((s=this.options.extensions)!=null&&s.startBlock){let c=1/0;const f=e.slice(1);let p;this.options.extensions.startBlock.forEach(d=>{p=d.call({lexer:this},f),typeof p=="number"&&p>=0&&(c=Math.min(c,p))}),c<1/0&&c>=0&&(l=e.substring(0,c+1))}if(this.state.top&&(o=this.tokenizer.paragraph(l))){const c=n.at(-1);r&&(c==null?void 0:c.type)==="paragraph"?(c.raw+=`
`+o.raw,c.text+=`
`+o.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=c.text):n.push(o),r=l.length!==e.length,e=e.substring(o.raw.length);continue}if(o=this.tokenizer.text(e)){e=e.substring(o.raw.length);const c=n.at(-1);(c==null?void 0:c.type)==="text"?(c.raw+=`
`+o.raw,c.text+=`
`+o.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=c.text):n.push(o);continue}if(e){const c="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(c);break}else throw new Error(c)}}return this.state.top=!0,n}inline(e,n=[]){return this.inlineQueue.push({src:e,tokens:n}),n}inlineTokens(e,n=[]){var o,l,c;let r=e,a=null;if(this.tokens.links){const f=Object.keys(this.tokens.links);if(f.length>0)for(;(a=this.tokenizer.rules.inline.reflinkSearch.exec(r))!=null;)f.includes(a[0].slice(a[0].lastIndexOf("[")+1,-1))&&(r=r.slice(0,a.index)+"["+"a".repeat(a[0].length-2)+"]"+r.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(a=this.tokenizer.rules.inline.anyPunctuation.exec(r))!=null;)r=r.slice(0,a.index)+"++"+r.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);for(;(a=this.tokenizer.rules.inline.blockSkip.exec(r))!=null;)r=r.slice(0,a.index)+"["+"a".repeat(a[0].length-2)+"]"+r.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);let i=!1,s="";for(;e;){i||(s=""),i=!1;let f;if((l=(o=this.options.extensions)==null?void 0:o.inline)!=null&&l.some(d=>(f=d.call({lexer:this},e,n))?(e=e.substring(f.raw.length),n.push(f),!0):!1))continue;if(f=this.tokenizer.escape(e)){e=e.substring(f.raw.length),n.push(f);continue}if(f=this.tokenizer.tag(e)){e=e.substring(f.raw.length),n.push(f);continue}if(f=this.tokenizer.link(e)){e=e.substring(f.raw.length),n.push(f);continue}if(f=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(f.raw.length);const d=n.at(-1);f.type==="text"&&(d==null?void 0:d.type)==="text"?(d.raw+=f.raw,d.text+=f.text):n.push(f);continue}if(f=this.tokenizer.emStrong(e,r,s)){e=e.substring(f.raw.length),n.push(f);continue}if(f=this.tokenizer.codespan(e)){e=e.substring(f.raw.length),n.push(f);continue}if(f=this.tokenizer.br(e)){e=e.substring(f.raw.length),n.push(f);continue}if(f=this.tokenizer.del(e)){e=e.substring(f.raw.length),n.push(f);continue}if(f=this.tokenizer.autolink(e)){e=e.substring(f.raw.length),n.push(f);continue}if(!this.state.inLink&&(f=this.tokenizer.url(e))){e=e.substring(f.raw.length),n.push(f);continue}let p=e;if((c=this.options.extensions)!=null&&c.startInline){let d=1/0;const m=e.slice(1);let g;this.options.extensions.startInline.forEach(v=>{g=v.call({lexer:this},m),typeof g=="number"&&g>=0&&(d=Math.min(d,g))}),d<1/0&&d>=0&&(p=e.substring(0,d+1))}if(f=this.tokenizer.inlineText(p)){e=e.substring(f.raw.length),f.raw.slice(-1)!=="_"&&(s=f.raw.slice(-1)),i=!0;const d=n.at(-1);(d==null?void 0:d.type)==="text"?(d.raw+=f.raw,d.text+=f.text):n.push(f);continue}if(e){const d="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(d);break}else throw new Error(d)}}return n}},To=class{constructor(t){k(this,"options");k(this,"parser");this.options=t||Pr}space(t){return""}code({text:t,lang:e,escaped:n}){var i;const r=(i=(e||"").match(vt.notSpaceStart))==null?void 0:i[0],a=t.replace(vt.endingNewline,"")+`
`;return r?'<pre><code class="language-'+_n(r)+'">'+(n?a:_n(a,!0))+`</code></pre>
`:"<pre><code>"+(n?a:_n(a,!0))+`</code></pre>
`}blockquote({tokens:t}){return`<blockquote>
${this.parser.parse(t)}</blockquote>
`}html({text:t}){return t}heading({tokens:t,depth:e}){return`<h${e}>${this.parser.parseInline(t)}</h${e}>
`}hr(t){return`<hr>
`}list(t){const e=t.ordered,n=t.start;let r="";for(let s=0;s<t.items.length;s++){const o=t.items[s];r+=this.listitem(o)}const a=e?"ol":"ul",i=e&&n!==1?' start="'+n+'"':"";return"<"+a+i+`>
`+r+"</"+a+`>
`}listitem(t){var n;let e="";if(t.task){const r=this.checkbox({checked:!!t.checked});t.loose?((n=t.tokens[0])==null?void 0:n.type)==="paragraph"?(t.tokens[0].text=r+" "+t.tokens[0].text,t.tokens[0].tokens&&t.tokens[0].tokens.length>0&&t.tokens[0].tokens[0].type==="text"&&(t.tokens[0].tokens[0].text=r+" "+_n(t.tokens[0].tokens[0].text),t.tokens[0].tokens[0].escaped=!0)):t.tokens.unshift({type:"text",raw:r+" ",text:r+" ",escaped:!0}):e+=r+" "}return e+=this.parser.parse(t.tokens,!!t.loose),`<li>${e}</li>
`}checkbox({checked:t}){return"<input "+(t?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph({tokens:t}){return`<p>${this.parser.parseInline(t)}</p>
`}table(t){let e="",n="";for(let a=0;a<t.header.length;a++)n+=this.tablecell(t.header[a]);e+=this.tablerow({text:n});let r="";for(let a=0;a<t.rows.length;a++){const i=t.rows[a];n="";for(let s=0;s<i.length;s++)n+=this.tablecell(i[s]);r+=this.tablerow({text:n})}return r&&(r=`<tbody>${r}</tbody>`),`<table>
<thead>
`+e+`</thead>
`+r+`</table>
`}tablerow({text:t}){return`<tr>
${t}</tr>
`}tablecell(t){const e=this.parser.parseInline(t.tokens),n=t.header?"th":"td";return(t.align?`<${n} align="${t.align}">`:`<${n}>`)+e+`</${n}>
`}strong({tokens:t}){return`<strong>${this.parser.parseInline(t)}</strong>`}em({tokens:t}){return`<em>${this.parser.parseInline(t)}</em>`}codespan({text:t}){return`<code>${_n(t,!0)}</code>`}br(t){return"<br>"}del({tokens:t}){return`<del>${this.parser.parseInline(t)}</del>`}link({href:t,title:e,tokens:n}){const r=this.parser.parseInline(n),a=Cf(t);if(a===null)return r;t=a;let i='<a href="'+t+'"';return e&&(i+=' title="'+_n(e)+'"'),i+=">"+r+"</a>",i}image({href:t,title:e,text:n,tokens:r}){r&&(n=this.parser.parseInline(r,this.parser.textRenderer));const a=Cf(t);if(a===null)return _n(n);t=a;let i=`<img src="${t}" alt="${n}"`;return e&&(i+=` title="${_n(e)}"`),i+=">",i}text(t){return"tokens"in t&&t.tokens?this.parser.parseInline(t.tokens):"escaped"in t&&t.escaped?t.text:_n(t.text)}},lc=class{strong({text:t}){return t}em({text:t}){return t}codespan({text:t}){return t}del({text:t}){return t}html({text:t}){return t}text({text:t}){return t}link({text:t}){return""+t}image({text:t}){return""+t}br(){return""}},jn=class Hc{constructor(e){k(this,"options");k(this,"renderer");k(this,"textRenderer");this.options=e||Pr,this.options.renderer=this.options.renderer||new To,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new lc}static parse(e,n){return new Hc(n).parse(e)}static parseInline(e,n){return new Hc(n).parseInline(e)}parse(e,n=!0){var a,i;let r="";for(let s=0;s<e.length;s++){const o=e[s];if((i=(a=this.options.extensions)==null?void 0:a.renderers)!=null&&i[o.type]){const c=o,f=this.options.extensions.renderers[c.type].call({parser:this},c);if(f!==!1||!["space","hr","heading","code","table","blockquote","list","html","paragraph","text"].includes(c.type)){r+=f||"";continue}}const l=o;switch(l.type){case"space":{r+=this.renderer.space(l);continue}case"hr":{r+=this.renderer.hr(l);continue}case"heading":{r+=this.renderer.heading(l);continue}case"code":{r+=this.renderer.code(l);continue}case"table":{r+=this.renderer.table(l);continue}case"blockquote":{r+=this.renderer.blockquote(l);continue}case"list":{r+=this.renderer.list(l);continue}case"html":{r+=this.renderer.html(l);continue}case"paragraph":{r+=this.renderer.paragraph(l);continue}case"text":{let c=l,f=this.renderer.text(c);for(;s+1<e.length&&e[s+1].type==="text";)c=e[++s],f+=`
`+this.renderer.text(c);n?r+=this.renderer.paragraph({type:"paragraph",raw:f,text:f,tokens:[{type:"text",raw:f,text:f,escaped:!0}]}):r+=f;continue}default:{const c='Token with "'+l.type+'" type was not found.';if(this.options.silent)return console.error(c),"";throw new Error(c)}}}return r}parseInline(e,n=this.renderer){var a,i;let r="";for(let s=0;s<e.length;s++){const o=e[s];if((i=(a=this.options.extensions)==null?void 0:a.renderers)!=null&&i[o.type]){const c=this.options.extensions.renderers[o.type].call({parser:this},o);if(c!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(o.type)){r+=c||"";continue}}const l=o;switch(l.type){case"escape":{r+=n.text(l);break}case"html":{r+=n.html(l);break}case"link":{r+=n.link(l);break}case"image":{r+=n.image(l);break}case"strong":{r+=n.strong(l);break}case"em":{r+=n.em(l);break}case"codespan":{r+=n.codespan(l);break}case"br":{r+=n.br(l);break}case"del":{r+=n.del(l);break}case"text":{r+=n.text(l);break}default:{const c='Token with "'+l.type+'" type was not found.';if(this.options.silent)return console.error(c),"";throw new Error(c)}}}return r}},Ao=(gc=class{constructor(t){k(this,"options");k(this,"block");this.options=t||Pr}preprocess(t){return t}postprocess(t){return t}processAllTokens(t){return t}provideLexer(){return this.block?Fn.lex:Fn.lexInline}provideParser(){return this.block?jn.parse:jn.parseInline}},k(gc,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens"])),gc),Pb=class{constructor(...t){k(this,"defaults",ec());k(this,"options",this.setOptions);k(this,"parse",this.parseMarkdown(!0));k(this,"parseInline",this.parseMarkdown(!1));k(this,"Parser",jn);k(this,"Renderer",To);k(this,"TextRenderer",lc);k(this,"Lexer",Fn);k(this,"Tokenizer",So);k(this,"Hooks",Ao);this.use(...t)}walkTokens(t,e){var r,a;let n=[];for(const i of t)switch(n=n.concat(e.call(this,i)),i.type){case"table":{const s=i;for(const o of s.header)n=n.concat(this.walkTokens(o.tokens,e));for(const o of s.rows)for(const l of o)n=n.concat(this.walkTokens(l.tokens,e));break}case"list":{const s=i;n=n.concat(this.walkTokens(s.items,e));break}default:{const s=i;(a=(r=this.defaults.extensions)==null?void 0:r.childTokens)!=null&&a[s.type]?this.defaults.extensions.childTokens[s.type].forEach(o=>{const l=s[o].flat(1/0);n=n.concat(this.walkTokens(l,e))}):s.tokens&&(n=n.concat(this.walkTokens(s.tokens,e)))}}return n}use(...t){const e=this.defaults.extensions||{renderers:{},childTokens:{}};return t.forEach(n=>{const r={...n};if(r.async=this.defaults.async||r.async||!1,n.extensions&&(n.extensions.forEach(a=>{if(!a.name)throw new Error("extension name required");if("renderer"in a){const i=e.renderers[a.name];i?e.renderers[a.name]=function(...s){let o=a.renderer.apply(this,s);return o===!1&&(o=i.apply(this,s)),o}:e.renderers[a.name]=a.renderer}if("tokenizer"in a){if(!a.level||a.level!=="block"&&a.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");const i=e[a.level];i?i.unshift(a.tokenizer):e[a.level]=[a.tokenizer],a.start&&(a.level==="block"?e.startBlock?e.startBlock.push(a.start):e.startBlock=[a.start]:a.level==="inline"&&(e.startInline?e.startInline.push(a.start):e.startInline=[a.start]))}"childTokens"in a&&a.childTokens&&(e.childTokens[a.name]=a.childTokens)}),r.extensions=e),n.renderer){const a=this.defaults.renderer||new To(this.defaults);for(const i in n.renderer){if(!(i in a))throw new Error(`renderer '${i}' does not exist`);if(["options","parser"].includes(i))continue;const s=i,o=n.renderer[s],l=a[s];a[s]=(...c)=>{let f=o.apply(a,c);return f===!1&&(f=l.apply(a,c)),f||""}}r.renderer=a}if(n.tokenizer){const a=this.defaults.tokenizer||new So(this.defaults);for(const i in n.tokenizer){if(!(i in a))throw new Error(`tokenizer '${i}' does not exist`);if(["options","rules","lexer"].includes(i))continue;const s=i,o=n.tokenizer[s],l=a[s];a[s]=(...c)=>{let f=o.apply(a,c);return f===!1&&(f=l.apply(a,c)),f}}r.tokenizer=a}if(n.hooks){const a=this.defaults.hooks||new Ao;for(const i in n.hooks){if(!(i in a))throw new Error(`hook '${i}' does not exist`);if(["options","block"].includes(i))continue;const s=i,o=n.hooks[s],l=a[s];Ao.passThroughHooks.has(i)?a[s]=c=>{if(this.defaults.async)return Promise.resolve(o.call(a,c)).then(p=>l.call(a,p));const f=o.call(a,c);return l.call(a,f)}:a[s]=(...c)=>{let f=o.apply(a,c);return f===!1&&(f=l.apply(a,c)),f}}r.hooks=a}if(n.walkTokens){const a=this.defaults.walkTokens,i=n.walkTokens;r.walkTokens=function(s){let o=[];return o.push(i.call(this,s)),a&&(o=o.concat(a.call(this,s))),o}}this.defaults={...this.defaults,...r}}),this}setOptions(t){return this.defaults={...this.defaults,...t},this}lexer(t,e){return Fn.lex(t,e??this.defaults)}parser(t,e){return jn.parse(t,e??this.defaults)}parseMarkdown(t){return(n,r)=>{const a={...r},i={...this.defaults,...a},s=this.onError(!!i.silent,!!i.async);if(this.defaults.async===!0&&a.async===!1)return s(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof n>"u"||n===null)return s(new Error("marked(): input parameter is undefined or null"));if(typeof n!="string")return s(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(n)+", string expected"));i.hooks&&(i.hooks.options=i,i.hooks.block=t);const o=i.hooks?i.hooks.provideLexer():t?Fn.lex:Fn.lexInline,l=i.hooks?i.hooks.provideParser():t?jn.parse:jn.parseInline;if(i.async)return Promise.resolve(i.hooks?i.hooks.preprocess(n):n).then(c=>o(c,i)).then(c=>i.hooks?i.hooks.processAllTokens(c):c).then(c=>i.walkTokens?Promise.all(this.walkTokens(c,i.walkTokens)).then(()=>c):c).then(c=>l(c,i)).then(c=>i.hooks?i.hooks.postprocess(c):c).catch(s);try{i.hooks&&(n=i.hooks.preprocess(n));let c=o(n,i);i.hooks&&(c=i.hooks.processAllTokens(c)),i.walkTokens&&this.walkTokens(c,i.walkTokens);let f=l(c,i);return i.hooks&&(f=i.hooks.postprocess(f)),f}catch(c){return s(c)}}}onError(t,e){return n=>{if(n.message+=`
Please report this to https://github.com/markedjs/marked.`,t){const r="<p>An error occurred:</p><pre>"+_n(n.message+"",!0)+"</pre>";return e?Promise.resolve(r):r}if(e)return Promise.reject(n);throw n}}},zr=new Pb;function Ae(t,e){return zr.parse(t,e)}Ae.options=Ae.setOptions=function(t){return zr.setOptions(t),Ae.defaults=zr.defaults,mf(Ae.defaults),Ae},Ae.getDefaults=ec,Ae.defaults=Pr,Ae.use=function(...t){return zr.use(...t),Ae.defaults=zr.defaults,mf(Ae.defaults),Ae},Ae.walkTokens=function(t,e){return zr.walkTokens(t,e)},Ae.parseInline=zr.parseInline,Ae.Parser=jn,Ae.parser=jn.parse,Ae.Renderer=To,Ae.TextRenderer=lc,Ae.Lexer=Fn,Ae.lexer=Fn.lex,Ae.Tokenizer=So,Ae.Hooks=Ao,Ae.parse=Ae,Ae.options,Ae.setOptions,Ae.use,Ae.walkTokens,Ae.parseInline,jn.parse,Fn.lex;var zb=ie('<span class="ac-badge ac-badge-pending">审核中</span>'),Fb=ie('<span class="ac-badge ac-badge-disputed">争议中</span>'),jb=ie('<span class="ac-badge ac-badge-sync">同步中</span>'),Hb=ie("<span> </span>"),Ub=ie('<span class="ac-menu-item ac-menu-done">已举报</span>'),qb=ie('<button type="button" class="ac-menu-item" role="menuitem">举报</button>'),$b=ie('<span class="ac-menu" role="menu"><!></span>'),Gb=ie('<span class="ac-more-wrap"><button type="button" class="ac-more-btn" aria-label="更多操作">⋯</button> <!></span>'),Yb=ie('<div class="ac-meta"></div>'),Zb=ie('<div class="ac-report-box"><input class="ac-input" placeholder="举报原因" maxlength="200"/> <button type="button" class="ac-btn ac-primary">提交</button> <button type="button" class="ac-btn ac-ghost">取消</button></div>'),Vb=ie('<div class="ac-replies"></div>'),Xb=ie('<div><div class="ac-card-head"><span class="ac-avatar"> </span> <span class="ac-name"> </span> <!> <!> <!> <span class="ac-time"> </span> <!> <!></div> <!> <div class="ac-content"></div> <div class="ac-actions"><button type="button" aria-label="点赞"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 21s-7.5-4.9-10-9.3C.5 8 2.4 4.5 6 4.5c2.2 0 3.6 1.2 6 3.8 2.4-2.6 3.8-3.8 6-3.8 3.6 0 5.5 3.5 4 7.2C19.5 16.1 12 21 12 21z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg> <span> </span></button> <button type="button" class="ac-action">回复</button></div> <!> <!> <!></div>');function Ro(t,e){Ln(e,!0);let n=zn(e,"depth",3,0);const r=ye(()=>e.node.comment),a=ye(()=>tb.sanitize(Ae.parse(b(r).content_raw,{async:!1,breaks:!0}))),i=ye(()=>am(b(r))),s=ye(()=>Wu(b(r).author_pubkey)),o=ye(()=>b(r).status==="pending"),l=ye(()=>b(r).status==="disputed"),c=ye(()=>e.syncing&&Date.now()-b(r).client_ts<12e4),f=ye(()=>b(r).expires_at!==null&&b(r).expires_at>Date.now()?`将于 ${om(b(r).expires_at)} 到期 · 获赞续期`:null),p=ye(()=>{var Y;return((Y=e.engine.state.me)==null?void 0:Y.pubkey)===b(r).author_pubkey}),d=ye(()=>e.engine.state.mode==="private");let m=xe(!1),g=xe(!1),v=xe(""),w=xe(!1),x=xe(!1);async function S(){await e.engine.toggleLike("comment",b(r).id)}async function E(Y,ce){await e.engine.submitComment({content:Y,parentId:b(r).id,...ce!==null?{meta:ce}:{}}),j(m,!1)}async function R(){const Y=b(v).trim();Y&&(await e.engine.report(b(r).id,Y),j(v,""),j(g,!1),j(w,!0))}function C(Y){const ce=b(r).meta;if(!ce||!e.renderMetaBadge)return;const Le=e.renderMetaBadge(ce);Le&&Y.appendChild(Le)}var N=Xb();let D;var I=z(N),F=z(I);let G;var oe=z(F),B=H(F,2),$=z(B),Z=H(B,2);{var te=Y=>{var ce=zb();Q(Y,ce)};fe(Z,Y=>{b(o)&&Y(te)})}var se=H(Z,2);{var Ee=Y=>{var ce=Fb();Q(Y,ce)};fe(se,Y=>{b(l)&&Y(Ee)})}var Be=H(se,2);{var U=Y=>{var ce=jb();Q(Y,ce)};fe(Be,Y=>{b(c)&&Y(U)})}var de=H(Be,2),ne=z(de),he=H(de,2);{var ge=Y=>{var ce=Hb();let Le;var jt=z(ce);Ne(()=>{Le=sr(ce,1,"ac-expiry",null,Le,{"ac-expiry-own":b(p)}),Te(jt,b(f))}),Q(Y,ce)};fe(he,Y=>{b(f)&&Y(ge)})}var L=H(he,2);{var V=Y=>{var ce=Gb(),Le=z(ce),jt=H(Le,2);{var Zn=dn=>{var Na=$b(),mr=z(Na);{var Da=Vn=>{var Yr=Ub();Q(Vn,Yr)},Ma=Vn=>{var Yr=qb();Ce("click",Yr,()=>{j(g,!0),j(x,!1)}),Q(Vn,Yr)};fe(mr,Vn=>{b(w)?Vn(Da):Vn(Ma,-1)})}Q(dn,Na)};fe(jt,dn=>{b(x)&&dn(Zn)})}Ce("click",Le,()=>j(x,!b(x))),Q(Y,ce)};fe(L,Y=>{b(d)||Y(V)})}var Oe=H(I,2);{var De=Y=>{var ce=Yb();zs(ce,Le=>C==null?void 0:C(Le)),Q(Y,ce)};fe(Oe,Y=>{b(r).meta&&e.renderMetaBadge&&Y(De)})}var He=H(Oe,2);Xg(He,()=>b(a),!0);var ut=H(He,2),me=z(ut);let W;var ft=z(me),ve=z(ft),Sn=H(ft,2),_e=z(Sn),Xe=H(me,2),zt=H(ut,2);{var Ie=Y=>{Ys(Y,{submitLabel:"回复",placeholder:"写下你的回复…",onSubmit:E,onCancel:()=>j(m,!1),get metaFields(){return e.metaFields}})};fe(zt,Y=>{b(m)&&Y(Ie)})}var Ft=H(zt,2);{var fn=Y=>{var ce=Zb(),Le=z(ce),jt=H(Le,2),Zn=H(jt,2);Ne(dn=>jt.disabled=dn,[()=>!b(v).trim()]),js(Le,()=>b(v),dn=>j(v,dn)),Ce("click",jt,R),Ce("click",Zn,()=>j(g,!1)),Q(Y,ce)};fe(Ft,Y=>{b(g)&&Y(fn)})}var No=H(Ft,2);{var Do=Y=>{var ce=Vb();Mr(ce,21,()=>e.node.children,Le=>Le.comment.id,(Le,jt)=>{{let Zn=ye(()=>n()+1);Ro(Le,{get engine(){return e.engine},get node(){return b(jt)},get syncing(){return e.syncing},get depth(){return b(Zn)},get renderMetaBadge(){return e.renderMetaBadge},get metaFields(){return e.metaFields}})}}),Q(Y,ce)};fe(No,Y=>{e.node.children.length>0&&Y(Do)})}Ne((Y,ce,Le)=>{D=sr(N,1,"ac-card",null,D,{"ac-card-reply":n()>0}),Je(N,"data-comment-id",b(r).id),G=vo(F,"",G,{"background-color":`hsl(${b(s)??""} 65% 45%)`}),Te(oe,Y),Je(B,"title",b(r).author_pubkey),Te($,b(i)),Je(de,"title",ce),Te(ne,Le),W=sr(me,1,"ac-action ac-like-btn",null,W,{"ac-liked":b(r).liked_by_me}),Je(ve,"fill",b(r).liked_by_me?"currentColor":"none"),Te(_e,b(r).like_count)},[()=>b(i).slice(0,1),()=>new Date(b(r).created_at).toLocaleString(),()=>im(b(r).created_at)]),Ce("click",me,S),Ce("click",Xe,()=>j(m,!b(m))),Q(t,N),Nn()}Dr(["click"]);var Wb=ie("<div><!></div>"),Kb=ie('<div class="ac-empty">暂无讨论，在页面底部写下第一条评论吧</div>'),Qb=ie('<!> <section class="ac-thread-card"><button type="button" class="ac-quote-bar"><span class="ac-quote-text"> </span> <span class="ac-group-count"> </span></button> <!> <!></section>',1),Jb=ie('<blockquote class="ac-evidence"> </blockquote>'),ev=ie("<!> <!>",1),tv=ie('<section class="ac-section"><h3 class="ac-section-title">原文已变更 <span class="ac-count"> </span></h3> <div class="ac-orphan-note">以下评论锚定的原文已找不到，仅保留引用存证；「重新挂接」将在后续版本提供。</div> <!></section>'),nv=ie('<button type="button" class="ac-action">自救（20-bit，终身一次）</button>'),rv=ie('<div class="ac-card ac-expired-card"><div class="ac-expired-content"> </div> <div class="ac-actions"><button type="button" class="ac-action">捞回（16-bit PoW）</button> <!></div></div>'),av=ie('<section class="ac-section"><h3 class="ac-section-title">已到期 <span class="ac-count"> </span></h3> <!></section>'),iv=ie('<div class="ac-toast" role="alert"> </div>'),ov=ie('<div class="ac-sections"><!> <section class="ac-section"><h3 class="ac-section-title">本页讨论 <span class="ac-count"> </span></h3> <!></section> <!> <!> <!> <!></div> <!>',1);function sv(t,e){Ln(e,!0);let n=zn(e,"governance",3,null),r=zn(e,"compose",3,null);const a=ye(()=>um(e.comments)),i=ye(()=>lm(b(a).live)),s=ye(()=>Gs(b(i).docThreads)),o=ye(()=>{var L;return((L=e.engine.state.me)==null?void 0:L.pubkey)??null}),l=ye(()=>[...b(i).groups].sort((L,V)=>(L.pos??1/0)-(V.pos??1/0))),c=ye(()=>r()?JSON.stringify(r().anchor):null),f=ye(()=>{var L;return b(c)===null?null:((L=b(l).find(V=>V.key===b(c)))==null?void 0:L.key)??null}),p=ye(()=>{var L;return r()&&r().anchor.type==="text"?((L=r().anchor.position)==null?void 0:L.start)??null:null}),d=ye(()=>{if(r()===null||b(f)!==null||b(p)===null)return null;const L=b(l).find(V=>V.pos!==null&&V.pos>b(p));return(L==null?void 0:L.key)??null}),m=ye(()=>r()!==null&&b(f)===null&&b(d)===null);let g=ar({}),v=xe(null),w;ni(()=>()=>clearTimeout(w));function x(L){var V;(V=e.onLocate)==null||V.call(e,L)}function S(L){j(v,L,!0),clearTimeout(w),w=setTimeout(()=>{j(v,null)},3e3)}async function E(L,V){if(!g[L]){g[L]=!0;try{await e.engine.rescue(L,V)}catch{S("捞回失败")}finally{g[L]=!1}}}var R=ov(),C=Mn(R),N=z(C);{var D=L=>{var V=Wb();let Oe;var De=z(V);{var He=me=>{var W=$u("本页已进入社区治理：新评论默认保留 7 天，获赞续期");Q(me,W)},ut=me=>{var W=$u("本页讨论规模较小，内容永久保留");Q(me,W)};fe(De,me=>{n().state==="active"?me(He):me(ut,-1)})}Ne(()=>Oe=sr(V,1,"ac-gov-banner",null,Oe,{"ac-gov-active":n().state==="active"})),Q(L,V)};fe(N,L=>{n()&&L(D)})}var I=H(N,2),F=z(I),G=H(z(F)),oe=z(G),B=H(F,2);{var $=L=>{var V=Kb();Q(L,V)},Z=L=>{var V=Ms(),Oe=Mn(V);Mr(Oe,17,()=>b(i).docThreads,De=>De.comment.id,(De,He)=>{{let ut=ye(()=>e.syncing>0);Ro(De,{get engine(){return e.engine},get node(){return b(He)},get syncing(){return b(ut)},get renderMetaBadge(){return e.renderMetaBadge},get metaFields(){return e.metaFields}})}}),Q(L,V)};fe(B,L=>{b(i).docThreads.length===0?L($):L(Z,-1)})}var te=H(I,2);Mr(te,17,()=>b(l),L=>L.key,(L,V)=>{var Oe=Qb(),De=Mn(Oe);{var He=Ie=>{ci(Ie,{get anchor(){return r().anchor},get onSubmit(){return e.onSubmitCompose},get onCancel(){return e.onCancelCompose},get metaFields(){return e.metaFields}})};fe(De,Ie=>{r()&&b(d)===b(V).key&&Ie(He)})}var ut=H(De,2),me=z(ut),W=z(me),ft=z(W),ve=H(W,2),Sn=z(ve),_e=H(me,2);Mr(_e,17,()=>b(V).threads,Ie=>Ie.comment.id,(Ie,Ft)=>{{let fn=ye(()=>e.syncing>0);Ro(Ie,{get engine(){return e.engine},get node(){return b(Ft)},get syncing(){return b(fn)},get renderMetaBadge(){return e.renderMetaBadge},get metaFields(){return e.metaFields}})}});var Xe=H(_e,2);{var zt=Ie=>{ci(Ie,{get anchor(){return r().anchor},showQuote:!1,get onSubmit(){return e.onSubmitCompose},get onCancel(){return e.onCancelCompose},get metaFields(){return e.metaFields}})};fe(Xe,Ie=>{r()&&b(f)===b(V).key&&Ie(zt)})}Ne(Ie=>{Je(me,"title",b(V).fullQuote??"定位到原文"),Te(ft,b(V).label),Te(Sn,`${Ie??""} 条`)},[()=>Gs(b(V).threads)]),Ce("click",me,()=>x(b(V).locateId)),Q(L,Oe)});var se=H(te,2);{var Ee=L=>{ci(L,{get anchor(){return r().anchor},get onSubmit(){return e.onSubmitCompose},get onCancel(){return e.onCancelCompose},get metaFields(){return e.metaFields}})};fe(se,L=>{r()&&b(m)&&L(Ee)})}var Be=H(se,2);{var U=L=>{var V=tv(),Oe=z(V),De=H(z(Oe)),He=z(De),ut=H(Oe,4);Mr(ut,17,()=>b(i).orphans,me=>me.comment.id,(me,W)=>{var ft=ev(),ve=Mn(ft);{var Sn=Xe=>{var zt=Jb(),Ie=z(zt);Ne(Ft=>{Je(zt,"title",b(W).comment.anchor.quote.exact),Te(Ie,`“${Ft??""}”`)},[()=>wo(b(W).comment.anchor.quote.exact,80)]),Q(Xe,zt)};fe(ve,Xe=>{b(W).comment.anchor&&b(W).comment.anchor.type==="text"&&Xe(Sn)})}var _e=H(ve,2);{let Xe=ye(()=>e.syncing>0);Ro(_e,{get engine(){return e.engine},get node(){return b(W)},get syncing(){return b(Xe)},get renderMetaBadge(){return e.renderMetaBadge},get metaFields(){return e.metaFields}})}Q(me,ft)}),Ne(()=>Te(He,b(i).orphans.length)),Q(L,V)};fe(Be,L=>{b(i).orphans.length>0&&L(U)})}var de=H(Be,2);{var ne=L=>{var V=av(),Oe=z(V),De=H(z(Oe)),He=z(De),ut=H(Oe,2);Mr(ut,17,()=>b(a).expired,me=>me.id,(me,W)=>{var ft=rv(),ve=z(ft),Sn=z(ve),_e=H(ve,2),Xe=z(_e),zt=H(Xe,2);{var Ie=Ft=>{var fn=nv();Ne(()=>fn.disabled=g[b(W).id]===!0),Ce("click",fn,()=>E(b(W).id,"self")),Q(Ft,fn)};fe(zt,Ft=>{b(o)!==null&&b(W).author_pubkey===b(o)&&Ft(Ie)})}Ne(()=>{Je(ft,"data-comment-id",b(W).id),Te(Sn,b(W).content_raw),Xe.disabled=g[b(W).id]===!0}),Ce("click",Xe,()=>E(b(W).id,"community")),Q(me,ft)}),Ne(()=>Te(He,b(a).expired.length)),Q(L,V)};fe(de,L=>{b(a).expired.length>0&&L(ne)})}var he=H(C,2);{var ge=L=>{var V=iv(),Oe=z(V);Ne(()=>Te(Oe,b(v))),Q(L,V)};fe(he,L=>{b(v)&&L(ge)})}Ne(()=>Te(oe,b(s))),Q(t,R),Nn()}Dr(["click"]);var cv=ie('<div class="ac-popover"><button type="button" class="ac-popover-btn">💬 评论</button></div>');function lv(t,e){Ln(e,!0);let n=zn(e,"composing",3,!1),r=xe(!1),a=xe(0),i=xe(0),s;function o(){j(r,!1)}function l(){if(n()){o();return}const g=window.getSelection();if(!g||g.isCollapsed||g.rangeCount===0){o();return}const v=g.anchorNode;if(v&&typeof ShadowRoot<"u"&&v.getRootNode()instanceof ShadowRoot){o();return}const w=g.getRangeAt(0);if(e.selectionRoot)try{if(!w.intersectsNode(e.selectionRoot)){o();return}}catch{o();return}const x=w.getBoundingClientRect();j(a,Math.round(x.right),!0),j(i,Math.round(x.bottom+8),!0),j(r,!0)}function c(){e.anchorFactory&&(s&&clearTimeout(s),s=setTimeout(l,180))}ni(()=>{if(e.anchorFactory)return document.addEventListener("selectionchange",c),()=>{document.removeEventListener("selectionchange",c),s&&clearTimeout(s)}});function f(){var x,S;if(!e.anchorFactory)return;const g=window.getSelection();if(!g||g.isCollapsed||g.rangeCount===0){j(r,!1);return}const v=e.anchorFactory(g);if(!v){j(r,!1);return}const w=g.getRangeAt(0).cloneRange();j(r,!1),(x=e.onCompose)==null||x.call(e,v,w),(S=window.getSelection())==null||S.removeAllRanges()}var p=Ms(),d=Mn(p);{var m=g=>{var v=cv();let w;var x=z(v);Ne(()=>w=vo(v,"",w,{left:`${b(a)??""}px`,top:`${b(i)??""}px`})),Ce("pointerdown",x,S=>S.preventDefault()),Ce("click",x,f),Q(g,v)};fe(d,g=>{b(r)&&g(m)})}Q(t,p),Nn()}Dr(["pointerdown","click"]);var uv=ie('<div class="ac-menu"><div class="ac-menu-pubkey"> </div> <input class="ac-input" placeholder="设置显示名（留空为匿名）" maxlength="32" aria-label="显示名"/> <div class="ac-menu-actions"><button type="button" class="ac-btn ac-primary"> </button> <button type="button" class="ac-btn ac-ghost">取消</button></div></div>'),fv=ie('<div class="ac-identity"><button type="button" class="ac-identity-btn" title="我的身份"><span class="ac-avatar"> </span> <span class="ac-name"> </span></button> <!></div>');function dv(t,e){Ln(e,!0);let n=xe(!1),r=xe(""),a=xe(!1);const i=ye(()=>e.me.displayName??`访客-${e.me.pubkey.slice(0,6)}`),s=ye(()=>Wu(e.me.pubkey));function o(){b(n)||j(r,e.me.displayName??"",!0),j(n,!b(n))}async function l(){if(!b(a)){j(a,!0);try{const S=b(r).trim();await e.engine.setDisplayName(S===""?null:S),j(n,!1)}finally{j(a,!1)}}}var c=fv(),f=z(c),p=z(f);let d;var m=z(p),g=H(p,2),v=z(g),w=H(f,2);{var x=S=>{var E=uv(),R=z(E),C=z(R),N=H(R,2),D=H(N,2),I=z(D),F=z(I),G=H(I,2);Ne(()=>{Je(R,"title",e.me.pubkey),Te(C,`公钥：${e.me.userIdShort??""}`),I.disabled=b(a),Te(F,b(a)?"保存中…":"保存")}),js(N,()=>b(r),oe=>j(r,oe)),Ce("click",I,l),Ce("click",G,()=>j(n,!1)),Q(S,E)};fe(w,S=>{b(n)&&S(x)})}Ne(S=>{d=vo(p,"",d,{"background-color":`hsl(${b(s)??""} 65% 45%)`}),Te(m,S),Te(v,b(i))},[()=>b(i).slice(0,1)]),Ce("click",f,o),Q(t,c),Nn()}Dr(["click"]);var hv=ie('<span class="ac-fab-badge"> </span>'),pv=ie('<!> <div class="ac-status">加载中…</div>',1),gv=ie('<!> <div class="ac-status ac-status-error"><div> </div> <button type="button" class="ac-btn ac-ghost">重试</button></div>',1),mv=ie('<div class="ac-root"><!> <button type="button" aria-label="打开评论区" title="评论"><span class="ac-fab-icon"> </span> <!></button> <aside><div class="ac-sidebar-header"><span class="ac-title">评论</span> <span class="ac-header-spacer"></span> <!> <button type="button" class="ac-close" aria-label="关闭">×</button></div> <div class="ac-sidebar-body"><!></div></aside> <div class="ac-docbar-wrap"><!></div></div>');function bv(t,e){Ln(e,!0);let n=xe(ar(e.engine.state)),r=xe(!1),a=xe(null);ni(()=>e.engine.subscribe(U=>{j(n,U,!0)})),ni(()=>()=>$s(null));const i=ye(()=>{var U;return((U=e.theme)==null?void 0:U.dark)??"auto"}),s=ye(()=>{var U;return((U=e.theme)==null?void 0:U.accent)??null}),o=ye(()=>b(n).me),l=ye(()=>b(n).comments.length);function c(U){return e.onLocate?e.onLocate(U):e.engine.locateComment(U,e.selectionRoot??document.body)}function f(U,de){j(a,{anchor:U,range:de}),j(r,!0),$s(de)}async function p(U,de){if(!b(a))return;const{anchor:ne,range:he}=b(a);await e.engine.submitComment({content:U,anchor:ne,optimisticRange:he,...de!==null?{meta:de}:{}}),d()}function d(){j(a,null),$s(null)}var m=mv();let g;var v=z(m);{let U=ye(()=>b(a)!==null);lv(v,{get selectionRoot(){return e.selectionRoot},get anchorFactory(){return e.anchorFactory},get composing(){return b(U)},onCompose:f})}var w=H(v,2);let x;var S=z(w),E=z(S),R=H(S,2);{var C=U=>{var de=hv(),ne=z(de);Ne(()=>Te(ne,b(l)>99?"99+":b(l))),Q(U,de)};fe(R,U=>{b(l)>0&&U(C)})}var N=H(w,2);let D;var I=z(N),F=H(z(I),4);{var G=U=>{dv(U,{get engine(){return e.engine},get me(){return b(o)}})};fe(F,U=>{b(o)&&U(G)})}var oe=H(F,2),B=H(I,2),$=z(B);{var Z=U=>{var de=pv(),ne=Mn(de);{var he=ge=>{ci(ge,{get anchor(){return b(a).anchor},onSubmit:p,onCancel:d,get metaFields(){return e.metaFields}})};fe(ne,ge=>{b(a)&&ge(he)})}Q(U,de)},te=U=>{var de=gv(),ne=Mn(de);{var he=De=>{ci(De,{get anchor(){return b(a).anchor},onSubmit:p,onCancel:d,get metaFields(){return e.metaFields}})};fe(ne,De=>{b(a)&&De(he)})}var ge=H(ne,2),L=z(ge),V=z(L),Oe=H(L,2);Ne(()=>Te(V,b(n).error??"加载失败")),Ce("click",Oe,()=>e.engine.refresh()),Q(U,de)},se=U=>{sv(U,{get engine(){return e.engine},get comments(){return b(n).comments},get governance(){return b(n).governance},get syncing(){return b(n).syncing},onLocate:c,get compose(){return b(a)},onSubmitCompose:p,onCancelCompose:d,get metaFields(){return e.metaFields},get renderMetaBadge(){return e.renderMetaBadge}})};fe($,U=>{b(n).status==="loading"||b(n).status==="idle"?U(Z):b(n).status==="error"?U(te,1):U(se,-1)})}var Ee=H(N,2),Be=z(Ee);_m(Be,{get engine(){return e.engine},get page(){return b(n).page},get commentCount(){return b(l)},get metaFields(){return e.metaFields},get docActions(){return e.docActions},onOpenComments:()=>j(r,!0)}),Ne(()=>{var U,de;Je(m,"data-theme",b(i)),g=vo(m,"",g,{"--ac-accent":b(s)}),x=sr(w,1,"ac-fab",null,x,{"ac-fab-pulse":((U=e.fab)==null?void 0:U.pulse)===!0}),Te(E,((de=e.fab)==null?void 0:de.label)??"💬"),D=sr(N,1,"ac-sidebar",null,D,{"ac-open":b(r)}),Je(N,"aria-hidden",!b(r))}),Ce("click",w,()=>j(r,!b(r))),Ce("click",oe,()=>j(r,!1)),Q(t,m),Nn()}Dr(["click"]);const vv=`
/* ── 显式 reset（仅 shadow 内部生效） ───────────────────── */
*, *::before, *::after { box-sizing: border-box; }
.ac-root, .ac-root * { margin: 0; padding: 0; }
.ac-root button, .ac-root input, .ac-root textarea {
  font: inherit; color: inherit; background: none; border: none;
}
.ac-root button { cursor: pointer; }
.ac-root button:disabled { cursor: not-allowed; opacity: .55; }

/* ── 主题默认值（dark / auto+系统深色 只声明 --ac-*-dark 深色 fallback，
     浅色 fallback 直接写在各使用点的 var() 里；不在 .ac-root 声明 --ac-* 本体，
     host style 上的 theme.vars 才能继承进来全主题生效） ─────────────── */
.ac-root {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
  font-family: var(--ac-font, system-ui, -apple-system, "Segoe UI", Roboto,
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif);
  font-size: var(--ac-font-size, 14px);
  line-height: var(--ac-line-height, 1.6);
  color: var(--ac-fg, var(--ac-fg-dark, #1f2329));
  color-scheme: light;
}
.ac-root[data-theme="dark"] {
  --ac-bg-dark: #1f2329;
  --ac-card-dark: #26292f;
  --ac-fg-dark: #e8eaed;
  --ac-muted-dark: #9aa0a6;
  --ac-border-dark: #3c4043;
  --ac-hover-dark: #2f3338;
  --ac-badge-bg-dark: rgba(225, 29, 72, .18);
  --ac-shadow-dark: 0 8px 30px rgba(0, 0, 0, .5), 0 2px 8px rgba(0, 0, 0, .35);
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  .ac-root[data-theme="auto"] {
    --ac-bg-dark: #1f2329;
    --ac-card-dark: #26292f;
    --ac-fg-dark: #e8eaed;
    --ac-muted-dark: #9aa0a6;
    --ac-border-dark: #3c4043;
    --ac-hover-dark: #2f3338;
    --ac-badge-bg-dark: rgba(225, 29, 72, .18);
    --ac-shadow-dark: 0 8px 30px rgba(0, 0, 0, .5), 0 2px 8px rgba(0, 0, 0, .35);
    color-scheme: dark;
  }
}

/* ── 通用件 ───────────────────────────────────────────── */
.ac-btn { border-radius: var(--ac-radius-md, 8px); padding: 5px 12px; font-size: 13px; }
.ac-primary { background: var(--ac-accent, #e11d48); color: var(--ac-on-accent, #fff); }
.ac-primary:hover:not(:disabled) { filter: brightness(1.06); }
.ac-ghost { color: var(--ac-muted, var(--ac-muted-dark, #646a73)); border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3)); background: transparent; }
.ac-ghost:hover { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); color: var(--ac-fg, var(--ac-fg-dark, #1f2329)); }
.ac-input, .ac-composer textarea {
  width: 100%;
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius, 10px);
  background: var(--ac-bg, var(--ac-bg-dark, #ffffff));
  color: var(--ac-fg, var(--ac-fg-dark, #1f2329));
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
}
.ac-composer textarea { resize: vertical; min-height: 64px; line-height: 1.55; }
.ac-input:focus, .ac-composer textarea:focus { border-color: var(--ac-accent, #e11d48); }
.ac-avatar {
  width: 24px; height: 24px; border-radius: var(--ac-radius-round, 50%);
  color: var(--ac-on-accent, #fff); font-size: 12px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  flex: none; user-select: none;
}
.ac-error { color: var(--ac-accent, #e11d48); font-size: 12px; margin-top: 6px; }

/* ── 右下角悬浮入口按钮 ────────────────────────────────── */
.ac-fab {
  position: fixed;
  right: 20px;
  bottom: 72px;
  width: 44px; height: 44px;
  border-radius: var(--ac-radius-round, 50%);
  background: var(--ac-accent, #e11d48);
  color: var(--ac-on-accent, #fff);
  display: flex; align-items: center; justify-content: center;
  --ac-fab-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
  box-shadow: var(--ac-fab-shadow);
  pointer-events: auto;
}
.ac-fab:hover { filter: brightness(1.06); }
.ac-fab-icon { font-size: 18px; line-height: 1; }
.ac-fab-badge {
  position: absolute; top: -4px; right: -4px;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: var(--ac-radius-round, 9px);
  background: var(--ac-fab-badge-bg, #1f2329); color: var(--ac-fab-badge-fg, #fff);
  font-size: 11px; line-height: 18px; text-align: center;
}
/* pulse 注意动画（fab.pulse 开启）：克制的 box-shadow 呼吸——accent 光圈由无到有再淡去 */
.ac-fab.ac-fab-pulse { animation: ac-fab-pulse 2.6s ease-in-out infinite; }
@keyframes ac-fab-pulse {
  0%, 100% { box-shadow: var(--ac-fab-shadow), 0 0 0 0 var(--ac-fab-pulse-ring, rgba(225, 29, 72, .3)); }
  50% { box-shadow: var(--ac-fab-shadow), 0 0 0 9px var(--ac-fab-pulse-fade, rgba(225, 29, 72, 0)); }
}
@media (prefers-reduced-motion: reduce) {
  .ac-fab.ac-fab-pulse { animation: none; }
}

/* ── 侧边栏 ───────────────────────────────────────────── */
.ac-sidebar {
  position: fixed; top: 0; right: 0;
  width: 380px; max-width: 100vw; height: 100vh;
  background: var(--ac-bg, var(--ac-bg-dark, #ffffff));
  border-left: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
  transform: translateX(105%);
  transition: transform .22s ease;
  display: flex; flex-direction: column;
  pointer-events: auto;
}
.ac-sidebar.ac-open { transform: translateX(0); }
.ac-sidebar-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  flex: none;
}
.ac-title { font-size: 15px; font-weight: 600; }
.ac-header-spacer { flex: 1; }
.ac-close { font-size: 18px; line-height: 1; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); padding: 4px 8px; border-radius: var(--ac-radius-sm, 6px); }
.ac-close:hover { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); color: var(--ac-fg, var(--ac-fg-dark, #1f2329)); }
.ac-sidebar-body { flex: 1; overflow-y: auto; padding: 12px 14px 24px; }
.ac-status { padding: 24px 0; text-align: center; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); }
.ac-status-error { color: var(--ac-accent, #e11d48); display: flex; flex-direction: column; gap: 10px; align-items: center; }

/* ── 分组 ─────────────────────────────────────────────── */
.ac-section { margin-bottom: 18px; }
.ac-section-title { font-size: 13px; font-weight: 600; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); margin-bottom: 8px; }
.ac-count { font-weight: 400; }
.ac-empty {
  color: var(--ac-muted, var(--ac-muted-dark, #646a73)); font-size: 13px;
  padding: 10px 12px;
  border: 1px dashed var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius, 10px);
}
.ac-group-header {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  text-align: left;
  padding: 8px 10px; margin-bottom: 8px;
  border-radius: var(--ac-radius, 10px);
  background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7));
}
.ac-group-header:hover { outline: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3)); }
.ac-group-quote {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px;
}
.ac-group-count { color: var(--ac-muted, var(--ac-muted-dark, #646a73)); font-size: 12px; flex: none; }
.ac-orphan-note { font-size: 12px; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); margin-bottom: 8px; }

/* ── 线程卡（飞书式：引用条 + 用户评论合一卡；引用弱化、发言为主） ── */
.ac-thread-card {
  background: var(--ac-card, var(--ac-card-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius-lg, 12px);
  padding: 10px 12px;
  margin-bottom: 10px;
}
/* reset(.ac-root button{border:none}，特异性 0-1-1) 会盖过单类选择器，这里用 .ac-root 前缀提权 */
.ac-root .ac-quote-bar {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  text-align: left;
  border-left: 3px solid var(--ac-quote, #eab308); /* 引用符小竖线：飞书同款纯黄（与划线同色语义） */
  padding: 2px 8px; margin-bottom: 8px;
  border-radius: var(--ac-radius-xs, 4px);
}
.ac-quote-bar:hover { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); }
.ac-quote-text {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); /* 引用弱化：小字淡色，把视觉权重让给用户发言 */
}
/* 卡内评论透明化：与用户发言合并为一个卡片，不再各自成卡 */
.ac-thread-card > .ac-card {
  border: none; background: transparent; border-radius: 0;
  padding: 0; margin-bottom: 0;
}
.ac-thread-card > .ac-card + .ac-card {
  border-top: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  margin-top: 8px; padding-top: 8px;
}
/* 同锚嵌入的作曲卡（Add a comment 形态）：收进线程卡内，去边框与外边距 */
.ac-thread-card > .ac-compose-card {
  border: none; padding: 8px 0 0; margin-bottom: 0;
  border-top: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
}

/* ── 治理横幅 / TTL 到期 / 墓碑与 toast ─────────────────── */
.ac-gov-banner {
  font-size: 12px; line-height: 1.5;
  color: var(--ac-muted, var(--ac-muted-dark, #646a73));
  background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7));
  border-radius: var(--ac-radius, 10px);
  padding: 8px 10px;
  margin-bottom: 14px;
}
.ac-gov-banner.ac-gov-active {
  color: var(--ac-accent, #e11d48);
  background: transparent;
  border: 1px solid var(--ac-accent, #e11d48);
}
.ac-expiry { flex-basis: 100%; font-size: 11px; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); }
.ac-expiry-own { color: var(--ac-accent, #e11d48); }
.ac-expired-card { opacity: .62; }
.ac-expired-content {
  color: var(--ac-muted, var(--ac-muted-dark, #646a73)); font-size: 13px;
  white-space: pre-wrap; word-break: break-word;
}
.ac-toast {
  position: fixed; right: 16px; bottom: 16px;
  background: var(--ac-fg, var(--ac-fg-dark, #1f2329)); color: var(--ac-bg, var(--ac-bg-dark, #ffffff));
  font-size: 13px; padding: 8px 14px; border-radius: var(--ac-radius, 10px);
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
}
.ac-evidence {
  border-left: 3px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  padding: 2px 10px;
  color: var(--ac-muted, var(--ac-muted-dark, #646a73));
  font-size: 13px;
  margin-bottom: 6px;
  word-break: break-word;
}

/* ── 侧边栏作曲卡（飞书式划词评论：引用预览 + 输入） ─────────────── */
.ac-compose-card {
  background: var(--ac-card, var(--ac-card-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius-lg, 12px);
  padding: 10px 12px;
  margin-bottom: 12px;
}
.ac-compose-quote {
  border-left: 3px solid var(--ac-quote, #eab308); /* 与作曲预览划线同色（飞书黄语义） */
  padding: 2px 10px;
  color: var(--ac-muted, var(--ac-muted-dark, #646a73));
  font-size: 13px;
  margin-bottom: 8px;
  word-break: break-word;
}

/* ── ⋯ 更多菜单（举报等次要动作收纳） ─────────────────── */
.ac-more-wrap { position: relative; flex: none; margin-left: 4px; }
.ac-more-btn {
  color: var(--ac-muted, var(--ac-muted-dark, #646a73)); font-size: 14px; line-height: 1;
  padding: 2px 6px; border-radius: var(--ac-radius-sm, 6px);
}
.ac-more-btn:hover { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); color: var(--ac-fg, var(--ac-fg-dark, #1f2329)); }
.ac-menu {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 10;
  display: flex; flex-direction: column; min-width: 88px;
  background: var(--ac-card, var(--ac-card-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius, 10px);
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
  padding: 4px;
}
.ac-menu-item {
  text-align: left; font-size: 13px;
  padding: 6px 10px; border-radius: var(--ac-radius-sm, 6px);
  color: var(--ac-fg, var(--ac-fg-dark, #1f2329));
}
button.ac-menu-item:hover { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); }
.ac-menu-item.ac-menu-done { color: var(--ac-muted, var(--ac-muted-dark, #646a73)); }

/* ── 评论卡片 ─────────────────────────────────────────── */
.ac-card {
  background: var(--ac-card, var(--ac-card-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius-lg, 12px);
  padding: 10px 12px;
  margin-bottom: 8px;
}
.ac-card-reply { border: none; background: transparent; border-radius: 0; padding: 8px 0 0; margin-bottom: 0; }
.ac-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ac-name { font-weight: 600; font-size: 13px; }
.ac-time { color: var(--ac-muted, var(--ac-muted-dark, #646a73)); font-size: 12px; margin-left: auto; }
.ac-badge { font-size: 11px; border-radius: var(--ac-radius-sm, 6px); padding: 1px 6px; flex: none; }
.ac-badge-pending { background: var(--ac-badge-bg, var(--ac-badge-bg-dark, #fff1f2)); color: var(--ac-accent, #e11d48); }
.ac-badge-sync { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); color: var(--ac-muted, var(--ac-muted-dark, #646a73)); }
/* disputed（C 类举报阶梯）：琥珀色折叠感状态徽标 */
.ac-badge-disputed { background: var(--ac-disputed-bg, #fff7e6); color: var(--ac-disputed-fg, #b26a00); }
.ac-content { margin-top: 6px; font-size: 14px; word-break: break-word; }
.ac-content p { margin: 0 0 .6em; }
.ac-content p:last-child { margin-bottom: 0; }
.ac-content a { color: var(--ac-accent, #e11d48); text-decoration: underline; }
.ac-content code {
  background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); border-radius: var(--ac-radius-xs, 4px); padding: 0 4px;
  font-size: 13px;
  font-family: var(--ac-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}
.ac-content pre {
  background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); border-radius: var(--ac-radius-md, 8px);
  padding: 8px 10px; overflow-x: auto; margin: 0 0 .6em;
}
.ac-content pre code { background: none; padding: 0; }
.ac-content ul, .ac-content ol { padding-left: 1.4em; margin: 0 0 .6em; }
.ac-content blockquote {
  border-left: 3px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  padding-left: 10px; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); margin: 0 0 .6em;
}
.ac-content img { max-width: 100%; }
.ac-content h1, .ac-content h2, .ac-content h3,
.ac-content h4, .ac-content h5, .ac-content h6 {
  font-size: 15px; font-weight: 600; margin: 0 0 .5em;
}
.ac-content hr { border: none; border-top: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3)); margin: .6em 0; }
.ac-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.ac-action {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--ac-muted, var(--ac-muted-dark, #646a73)); font-size: 12px;
  padding: 2px 6px; border-radius: var(--ac-radius-sm, 6px);
}
.ac-action:hover { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); color: var(--ac-fg, var(--ac-fg-dark, #1f2329)); }
.ac-action.ac-liked { color: var(--ac-accent, #e11d48); }
.ac-action-done { cursor: default; }
.ac-action-done:hover { background: none; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); }
.ac-replies { margin-top: 4px; padding-left: 12px; border-left: 2px solid var(--ac-border, var(--ac-border-dark, #dee0e3)); }
.ac-report-box { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
.ac-report-box .ac-input { flex: 1; min-width: 0; }

/* ── 作曲器 ───────────────────────────────────────────── */
.ac-composer-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

/* ── 集成方扩展位（metaFields / renderMetaBadge 挂载点；内容样式全由集成方负责） ── */
.ac-meta-fields { margin-bottom: 8px; }
.ac-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px; }
.ac-meta:empty { display: none; }

/* ── 底部文档条 DocBar ────────────────────────────────── */
.ac-docbar-wrap {
  position: fixed; left: 50%; bottom: 14px;
  transform: translateX(-50%);
  pointer-events: auto;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  width: max-content; max-width: calc(100vw - 24px);
}
.ac-docbar {
  display: flex; align-items: center; gap: 10px;
  background: var(--ac-bg, var(--ac-bg-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius-pill, 999px);
  padding: 6px 14px;
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
}
.ac-docbar-btn {
  display: inline-flex; align-items: center; gap: 5px;
  color: var(--ac-muted, var(--ac-muted-dark, #646a73)); font-size: 13px;
  padding: 3px 6px; border-radius: var(--ac-radius-md, 8px);
}
.ac-docbar-btn:hover { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); color: var(--ac-fg, var(--ac-fg-dark, #1f2329)); }
.ac-docbar-btn.ac-liked { color: var(--ac-accent, #e11d48); }
.ac-docbar-count { color: var(--ac-muted, var(--ac-muted-dark, #646a73)); font-size: 13px; white-space: nowrap; }
.ac-write-btn { color: var(--ac-accent, #e11d48); font-weight: 600; }
.ac-sep { width: 1px; height: 16px; background: var(--ac-border, var(--ac-border-dark, #dee0e3)); flex: none; }
.ac-docbar-composer {
  width: min(520px, calc(100vw - 32px));
  background: var(--ac-bg, var(--ac-bg-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius-lg, 12px);
  padding: 10px;
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
}

/* ── DocBar 微互动 popover（docActions 扩展位；控件样式全由集成方负责） ── */
.ac-docaction-btn.ac-docaction-open {
  background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7));
  color: var(--ac-fg, var(--ac-fg-dark, #1f2329));
}
.ac-docaction-pop {
  width: min(320px, calc(100vw - 32px));
  background: var(--ac-bg, var(--ac-bg-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius-lg, 12px);
  padding: 10px;
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
}
.ac-docaction-fields:empty { display: none; }
.ac-docaction-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

/* ── 划词浮动气泡 ─────────────────────────────────────── */
.ac-popover {
  position: fixed;
  z-index: 2147483646;
  transform: translateX(-50%);
  pointer-events: auto;
}
.ac-popover-btn {
  background: var(--ac-accent, #e11d48); color: var(--ac-on-accent, #fff);
  border-radius: var(--ac-radius-pill, 999px); padding: 6px 12px;
  font-size: 13px; white-space: nowrap;
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
}
.ac-popover-composer {
  width: min(360px, calc(100vw - 24px));
  background: var(--ac-bg, var(--ac-bg-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius-lg, 12px);
  padding: 10px;
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
}

/* ── 身份菜单 ─────────────────────────────────────────── */
.ac-identity { position: relative; }
.ac-identity-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 8px; border-radius: var(--ac-radius-pill, 999px);
}
.ac-identity-btn:hover { background: var(--ac-hover, var(--ac-hover-dark, #f5f6f7)); }
.ac-identity .ac-avatar { width: 20px; height: 20px; font-size: 11px; }
.ac-identity .ac-name {
  font-size: 13px; max-width: 120px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ac-menu {
  position: absolute; top: calc(100% + 6px); right: 0;
  width: 220px;
  background: var(--ac-bg, var(--ac-bg-dark, #ffffff));
  border: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
  border-radius: var(--ac-radius-lg, 12px);
  padding: 10px;
  box-shadow: var(--ac-shadow, var(--ac-shadow-dark, 0 8px 30px rgba(31, 35, 41, .12), 0 2px 8px rgba(31, 35, 41, .08)));
  z-index: 1;
}
.ac-menu-pubkey { font-size: 12px; color: var(--ac-muted, var(--ac-muted-dark, #646a73)); margin-bottom: 8px; word-break: break-all; }
.ac-menu-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }

/* ── 移动端：全宽底部抽屉 ──────────────────────────────── */
@media (max-width: 640px) {
  .ac-sidebar {
    top: auto; bottom: 0; left: 0; right: 0;
    width: auto; height: 72vh;
    border-left: none;
    border-top: 1px solid var(--ac-border, var(--ac-border-dark, #dee0e3));
    border-radius: var(--ac-radius-xl, 14px) var(--ac-radius-xl, 14px) 0 0;
    transform: translateY(105%);
  }
  .ac-sidebar.ac-open { transform: translateY(0); }
  .ac-fab { bottom: 84px; }
  .ac-docbar-wrap {
    left: 0; right: 0; bottom: 0;
    transform: none;
    width: 100%; max-width: none;
    padding: 8px 10px;
  }
  .ac-docbar { width: 100%; justify-content: space-around; border-radius: var(--ac-radius-xl, 14px); }
  .ac-docbar-composer { width: 100%; }
  .ac-docaction-pop { width: 100%; }
}
`,wv=/^--ac-/;function yv(t,e){var f;const n=t.attachShadow({mode:"open"}),r=p=>{p.stopPropagation()};for(const p of["keydown","keypress","keyup"])n.addEventListener(p,r);const a=document.createElement("style");a.textContent=vv,n.appendChild(a);const i=document.createElement("div");n.appendChild(i);const s=[];if((f=e.theme)!=null&&f.vars)for(const[p,d]of Object.entries(e.theme.vars))wv.test(p)&&(t.style.setProperty(p,d),s.push(p));const o={engine:e.engine};e.selectionRoot!==void 0&&(o.selectionRoot=e.selectionRoot),e.anchorFactory!==void 0&&(o.anchorFactory=e.anchorFactory),e.onLocate!==void 0&&(o.onLocate=e.onLocate),e.theme!==void 0&&(o.theme=e.theme),e.metaFields!==void 0&&(o.metaFields=e.metaFields),e.renderMetaBadge!==void 0&&(o.renderMetaBadge=e.renderMetaBadge),e.docActions!==void 0&&(o.docActions=e.docActions),e.fab!==void 0&&(o.fab=e.fab);const l=Ug(bv,{target:i,props:o});let c=!1;return{destroy(){if(!c){c=!0;for(const p of["keydown","keypress","keyup"])n.removeEventListener(p,r);for(const p of s)t.style.removeProperty(p);$g(l),a.remove(),i.remove()}}}}const uc={VITE_AC_API_BASE:"https://ac-api.poorhub.store",VITE_AC_API_KEY:"ack_ueexN5MaL-pwdvQCiieKEniHbhGMXF37",VITE_AC_PROJECT_ID:"ac-coding-plan"},xv={"coding-plan.poorhub.store":"https://ac-api.poorhub.store","plan.xiaocha.online":"https://ac-api.xiaocha.online"};function _v(t,e){return xv[t]??e}const kv=uc.VITE_AC_API_BASE,fc={apiBase:_v(((Uf=globalThis.location)==null?void 0:Uf.hostname)??"",kv),projectId:uc.VITE_AC_PROJECT_ID,apiKey:uc.VITE_AC_API_KEY},Lf=[-10,-7,-5,-3,0,3,5,7,10];function Ev(t){return typeof t=="number"&&Lf.includes(t)}function Nf(t){return t<0?"neg":t>0?"pos":"zero"}const Me={paper:"#f4f2ec",ink:"#16213a",muted:"#8a93ad",accent:"#d97706",pos:"#1e7d3c",neg:"#bf352c",zero:"#8a93ad",zeroBg:"#eceae2",midBg:"#faf0d9",fontSans:'"PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',fontMono:'"JetBrains Mono", "SF Mono", Consolas, "Courier New", monospace'},Sv={"--ac-bg":Me.paper,"--ac-card":"#ffffff","--ac-fg":Me.ink,"--ac-muted":Me.muted,"--ac-border":Me.ink,"--ac-hover":Me.zeroBg,"--ac-on-accent":Me.paper,"--ac-quote":Me.accent,"--ac-fab-badge-bg":Me.accent,"--ac-fab-badge-fg":"#ffffff","--ac-fab-pulse-ring":"rgba(22, 33, 58, .3)","--ac-fab-pulse-fade":"rgba(22, 33, 58, 0)","--ac-font":Me.fontSans,"--ac-font-mono":Me.fontMono,"--ac-shadow":"4px 4px 0 rgba(22, 33, 58, .85)","--ac-radius-xs":"0px","--ac-radius-sm":"0px","--ac-radius-md":"0px","--ac-radius":"0px","--ac-radius-lg":"2px","--ac-radius-xl":"2px"},Tv=["欺诈","言过其实","单位混淆","高峰降速","年付锁定","不退款","性价比真香","文档诚实","客服靠谱","单位通胀","账面高手","能力过硬","旗舰真材","量大管饱"],dc=5,Co=12,Av=`
.acf-sec { margin-bottom: 8px; }
.acf-label { font-size: 12px; color: var(--ac-muted); margin-bottom: 4px; }
.acf-row { display: flex; flex-wrap: wrap; gap: 4px; }
.ac-root .acf-score, .ac-root .acf-chip {
  border: 1px solid var(--ac-border); border-radius: 6px;
  padding: 1px 7px; font-size: 12px; line-height: 1.7;
  color: var(--ac-fg); background: var(--ac-card);
}
.ac-root .acf-score { font-family: var(--ac-font-mono); font-weight: 700; }
.ac-root .acf-score:hover, .ac-root .acf-chip:hover { border-color: var(--ac-accent); }
.ac-root .acf-score.sel.pos { background: ${Me.pos}; border-color: ${Me.pos}; color: #fff; }
.ac-root .acf-score.sel.neg { background: ${Me.neg}; border-color: ${Me.neg}; color: #fff; }
.ac-root .acf-score.sel.zero { background: ${Me.zero}; border-color: ${Me.zero}; color: #fff; }
.ac-root .acf-chip.on { background: var(--ac-accent); border-color: var(--ac-accent); color: var(--ac-on-accent); }
.ac-root .acf-input {
  flex: 1; min-width: 130px;
  border: 1px solid var(--ac-border); border-radius: 6px;
  background: var(--ac-card); color: var(--ac-fg);
  padding: 3px 8px; font-size: 12px; outline: none;
}
.ac-root .acf-input:focus { border-color: var(--ac-accent); }
.acf-ftags { margin-top: 4px; }
.ac-root .acf-ftag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; border-radius: 6px; padding: 1px 4px 1px 7px;
  border: 1px solid ${Me.accent}; background: ${Me.midBg}; color: ${Me.ink};
}
.ac-root .acf-ftag-x {
  font-family: var(--ac-font-mono); font-weight: 700; font-size: 11px;
  color: ${Me.neg}; padding: 0 2px; line-height: 1.4;
}
.acf-hint { font-size: 11px; color: ${Me.neg}; min-height: 14px; margin-top: 2px; }
.acf-badge { font-size: 11px; font-weight: 600; border-radius: 6px; padding: 1px 6px; color: #fff; }
.acf-badge.pos { background: ${Me.pos}; }
.acf-badge.neg { background: ${Me.neg}; }
.acf-badge.zero { background: ${Me.zero}; }
.acf-tag {
  font-size: 11px; border-radius: 6px; padding: 1px 6px;
  background: var(--ac-hover); color: var(--ac-muted);
  border: 1px solid var(--ac-border);
}
`;function mi(t,...e){const n=document.createElement("div");n.className="acf-sec";const r=document.createElement("div");return r.className="acf-label",r.textContent=t,n.append(r,...e),n}function Df(){let t=null;const e=document.createElement("div");e.className="acf-row";for(const n of Lf){const r=document.createElement("button");r.type="button",r.className=`acf-score ${Nf(n)}`,r.dataset.score=String(n),r.textContent=n>0?`+${n}`:String(n),r.addEventListener("click",()=>{t=t===n?null:n,e.querySelectorAll(".acf-score").forEach(a=>{a.classList.toggle("sel",Number(a.dataset.score)===t)})}),e.appendChild(r)}return{row:e,get:()=>t}}function Mf(){const t=new Set,e=document.createElement("div");e.className="acf-row";for(const n of Tv){const r=document.createElement("button");r.type="button",r.className="acf-chip",r.textContent=n,r.addEventListener("click",()=>{r.classList.toggle("on")?t.add(n):t.delete(n)}),e.appendChild(r)}return{row:e,get:()=>[...t]}}function Rv(){const t=document.createElement("input");t.className="acf-input",t.type="text",t.maxLength=Co,t.placeholder="输入后回车,如:实测踩坑";const e=document.createElement("button");e.type="button",e.className="acf-chip",e.textContent="添加";const n=document.createElement("div");n.className="acf-row",n.append(t,e);const r=document.createElement("div");r.className="acf-row acf-ftags";const a=document.createElement("div");a.className="acf-hint";const i=mi(`自由标签(回车添加,去重,≤ ${dc} 个,每个 ≤ ${Co} 字符)`,n,r,a),s=[],o=()=>{r.innerHTML="";for(const f of s){const p=document.createElement("span");p.className="acf-ftag",p.dataset.tag=f,p.textContent=f;const d=document.createElement("button");d.type="button",d.className="acf-ftag-x",d.title="移除",d.textContent="×",p.appendChild(d),r.appendChild(p)}},l=f=>{const p=f.trim();if(p){if([...p].length>Co){a.textContent=`自由标签每个 ≤ ${Co} 字符`;return}if(s.includes(p)){a.textContent=`「${p}」已添加过`;return}if(s.length>=dc){a.textContent=`自由标签最多 ${dc} 个`;return}s.push(p),a.textContent="",o()}},c=()=>{l(t.value),t.value="",t.dispatchEvent(new Event("input",{bubbles:!0}))};return t.addEventListener("keydown",f=>{f.key==="Enter"&&(f.preventDefault(),c())}),e.addEventListener("click",c),r.addEventListener("click",f=>{var g;const p=f.target.closest(".acf-ftag-x"),d=(g=p==null?void 0:p.parentElement)==null?void 0:g.dataset.tag;if(!d)return;const m=s.indexOf(d);m>=0&&s.splice(m,1),o()}),{sec:i,get:()=>[...s]}}function Bf(t,e){if(t===null&&e.length===0)return null;const n={kind:"field",tags:e};return t!==null&&(n.score=t),n}function Cv(t){const e=Df(),n=Mf();return t.append(mi("评分(可选,不选就是纯评论)",e.row),mi("预设标签(点选切换)",n.row)),()=>Bf(e.get(),n.get())}const Iv=[{id:"rate-tag",label:"评分 · 标签",title:"快评:选评分 / 点标签即可发布,无需写正文",render(t){const e=Df(),n=Mf(),r=Rv();return t.append(mi("评分(可选,不选就是纯标签)",e.row),mi("预设标签(点选切换)",n.row),r.sec),()=>Bf(e.get(),[...new Set([...n.get(),...r.get()])])}}];function Ov(t){if(t.kind!=="field")return null;const e=Ev(t.score)?t.score:null,n=Array.isArray(t.tags)?[...new Set(t.tags.filter(a=>typeof a=="string"&&a.trim()!==""))]:[];if(e===null&&n.length===0)return null;const r=document.createDocumentFragment();if(e!==null){const a=document.createElement("span");a.className=`acf-badge ${Nf(e)}`,a.textContent=e>0?`+${e}`:String(e),r.appendChild(a)}for(const a of n){const i=document.createElement("span");i.className="acf-tag",i.textContent=a,r.appendChild(i)}return r}let ur=null,bi=null,vi=null,Pf=location.href,wi=null;async function zf(){Pf=location.href;const t=kp();await t.init({projectId:fc.projectId,apiKey:fc.apiKey,apiBase:fc.apiBase,url:location.href,title:document.title});const e=document.createElement("div");e.id="any-comments-field-host",document.body.appendChild(e),vi=e,bi=yv(e,{engine:t,selectionRoot:document.body,anchorFactory:i=>zh(document.body,i),theme:{accent:Me.ink,vars:Sv},fab:{label:"评",pulse:!0},metaFields:Cv,docActions:Iv,renderMetaBadge:Ov});const n=document.createElement("style");n.textContent=Av,e.shadowRoot.appendChild(n),ur=t;let r=!1;const a=()=>{r||(r=!0,setTimeout(()=>{r=!1;try{t.highlightAll(document.body)}catch(i){console.warn("[any-comments] highlightAll failed:",i)}},0))};a(),t.subscribe(a),wi=Gh(document)}function Lv(){bi==null||bi.destroy(),bi=null,ur==null||ur.destroy(),ur=null,vi==null||vi.remove(),vi=null,wi==null||wi(),wi=null,$h()}function Ff(){location.href!==Pf&&(Lv(),zf().catch(t=>console.warn("[any-comments] setup failed:",t)))}window.addEventListener("popstate",Ff),setInterval(Ff,1e3),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&(ur==null||ur.refresh().catch(t=>console.warn("[any-comments] refresh failed:",t)))}),zf().catch(t=>console.warn("[any-comments] init failed:",t))})();
