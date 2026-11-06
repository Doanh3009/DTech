export function confirmBusinessNavigation(){
 return !document.querySelector('[data-business-unsaved="true"]')||window.confirm("Rời chứng từ đang có thay đổi chưa hoàn tất?");
}
