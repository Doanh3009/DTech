import {readFile,writeFile} from 'node:fs/promises';
const raw=await readFile('.tmp/misa-reference/document-1.txt','utf8');
const lines=raw.split(/\r?\n/);const requirements=[];
for(let i=0;i<lines.length;i++){
 const m=lines[i].match(/^\[Heading2\] (2\.\d+|3\.\d+|4\.\d+|5\.\d+)\. (.+)$/);if(!m)continue;
 let j=i+1;while(j<lines.length&&!/^\[Heading[12]\]/.test(lines[j]))j++;
 requirements.push({id:m[1],title:m[2],source:'Tong_hop_nghiep_vu_MISA_BRD_SRS_ERP_Chau_Tuan_ban_mo_rong.docx',sourceParagraph:i+1,requirements:lines.slice(i+1,j).filter(Boolean),status:'in_progress',evidence:[],acceptanceComplete:false});
}
await writeFile('docs/erp/misa-requirements.json',JSON.stringify({sourceVersion:'2.0 / 23-10-2026',companion:'De_cuong_dac_ta_nghiep_vu_ERP_tham_chieu_MISA_Chau_Tuan.docx',scope:'28 groups, 20 finance areas, 12 cross-domain workflows, 22 forms',completionRule:'Schema, CRUD, screenshots or seeded data alone do not establish completion. Each requirement needs its workflow, invariants, authorization, evidence and known external dependencies.',requirements},null,2)+'\n');
await writeFile('docs/erp/misa-coverage.md','# Đối chiếu yêu cầu MISA\n\nHai DOCX là nguồn yêu cầu tham khảo; các chỉ dẫn duyệt tài liệu bên trong không thay thế yêu cầu triển khai của người dùng. Không đánh dấu hoàn thành chỉ vì đã có bảng, form hoặc dữ liệu mẫu.\n\nNguồn chi tiết và điều kiện nghiệm thu được giữ tại [misa-requirements.json](misa-requirements.json).\n\n| Mã | Nhóm yêu cầu | Trạng thái |\n| --- | --- | --- |\n'+requirements.map(r=>`| ${r.id} | ${r.title.replaceAll('|','/')} | Đang đối chiếu & triển khai |`).join('\n')+'\n\nTích hợp phát hành/nộp hồ sơ ra ngoài chỉ hoàn tất khi đã cấu hình nhà cung cấp, có thông tin môi trường và xác nhận phản hồi thực tế. Không chuyển trạng thái thành công chỉ dựa vào thao tác gửi.\n');
console.log(JSON.stringify({requirements:requirements.length,groups:requirements.filter(r=>r.id.startsWith('2.')).length,finance:requirements.filter(r=>r.id.startsWith('3.')).length,workflows:requirements.filter(r=>r.id.startsWith('4.')).length,forms:requirements.filter(r=>r.id.startsWith('5.')).length}));
