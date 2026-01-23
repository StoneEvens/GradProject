import React, { useState } from 'react';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import '../components/Header.css';
import '../components/BottomNavigationBar.css';
import './PetHistory.css';

const stepLabels = ['基本資訊', '疾病紀錄', '疫苗施打', '聯絡資訊', '通訊錄'];

export default function PetHistory() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
  name: '', gender: '', species: '', breed: '', birthDate: '', features: '', image: null,
  diseases: [], vaccines: [], contact: {}, chip: {}, addressBook: []
});

const [diseaseInput, setDiseaseInput] = useState({
  type: '', name: '', status: '', medication: '', date: '', note: '', editIndex: -1
});

const [vaccineInput, setVaccineInput] = useState({
  name: '', types: [], date: '', note: '', editIndex: -1
});

const [addressModal, setAddressModal] = useState(false);

const [newContact, setNewContact] = useState({
  name: '', phone: '', email: '', address: '', note: ''
});

// 🧾 頁面一：基本資料
const handleChange = (e) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
};

const handleImageUpload = (e) => {
  setFormData(prev => ({ ...prev, image: e.target.files[0] }));
};

const saveData = () => {
  localStorage.setItem('petHistory', JSON.stringify(formData));
  alert('資料已儲存');
};

// 🧬 頁面二：疾病紀錄
const handleDiseaseChange = (e) => {
  const { name, value } = e.target;
  setDiseaseInput((prev) => ({ ...prev, [name]: value }));
};

const addDisease = () => {
  if (diseaseInput.editIndex > -1) {
    const updated = [...formData.diseases];
    updated[diseaseInput.editIndex] = { ...diseaseInput };
    setFormData(prev => ({ ...prev, diseases: updated }));
  } else {
    setFormData(prev => ({ ...prev, diseases: [...prev.diseases, { ...diseaseInput }] }));
  }
  setDiseaseInput({ type: '', name: '', status: '', medication: '', date: '', note: '', editIndex: -1 });
};

const editDisease = (index) => {
  const item = formData.diseases[index];
  setDiseaseInput({ ...item, editIndex: index });
};

const deleteDisease = (index) => {
  const updated = formData.diseases.filter((_, i) => i !== index);
  setFormData(prev => ({ ...prev, diseases: updated }));
};

// 💉 頁面三：疫苗施打
const handleVaccineChange = (e) => {
  const { name, value } = e.target;
  setVaccineInput(prev => ({ ...prev, [name]: value }));
};

const openVaccineModal = () => {
  const options = ['疫苗一', '疫苗二', '疫苗三', '疫苗四', '疫苗五'];
  const selected = prompt(`請輸入疫苗種類（以逗號分隔）：\n${options.join(', ')}`);
  if (selected) {
    setVaccineInput(prev => ({
      ...prev,
      types: selected.split(',').map(s => s.trim())
    }));
  }
};

const addVaccine = () => {
  if (vaccineInput.editIndex > -1) {
    const updated = [...formData.vaccines];
    updated[vaccineInput.editIndex] = { ...vaccineInput };
    setFormData(prev => ({ ...prev, vaccines: updated }));
  } else {
    setFormData(prev => ({ ...prev, vaccines: [...prev.vaccines, { ...vaccineInput }] }));
  }
  setVaccineInput({ name: '', types: [], date: '', note: '', editIndex: -1 });
};

const deleteVaccine = (index) => {
  const updated = formData.vaccines.filter((_, i) => i !== index);
  setFormData(prev => ({ ...prev, vaccines: updated }));
};

// 📒 頁面五：通訊錄
const addAddressEntry = () => {
  setFormData(prev => ({
    ...prev,
    addressBook: [...prev.addressBook, newContact]
  }));
  setNewContact({ name: '', phone: '', email: '', address: '', note: '' });
  setAddressModal(false);
};

const deleteAddressEntry = (index) => {
  const updated = formData.addressBook.filter((_, i) => i !== index);
  setFormData(prev => ({ ...prev, addressBook: updated }));
};

// 🚥 進度條
const renderProgress = () => (
  <div className="progress-bar">
    {stepLabels.map((label, index) => (
      <div key={index} className={`progress-step ${step === index ? 'active' : ''}`} onClick={() => setStep(index)}>
        <div className="dot" /><span>{label}</span>
      </div>
    ))}
  </div>
);

  const renderStep = () => {
  switch (step) {
    case 0:
      return (
        <div className="step-content">
          <div className="form-box">
            <label>名字：<input type="text" name="name" value={formData.name} onChange={handleChange} /></label>
            <label>性別：
              <select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="">請選擇</option>
                <option value="公">公</option>
                <option value="母">母</option>
              </select>
            </label>
            <label>物種：
              <select name="species" value={formData.species} onChange={handleChange}>
                <option value="">請選擇</option>
                <option value="狗">狗</option>
                <option value="貓">貓</option>
              </select>
            </label>
            <label>品種：
              <select name="breed" value={formData.breed} onChange={handleChange}>
                <option value="">請選擇</option>
                <option value="拉不拉多">拉不拉多</option>
                <option value="柴犬">柴犬</option>
                <option value="秋田犬">秋田犬</option>
              </select>
            </label>
            <label>出生日期：<input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} /></label>
            <label>毛色與特徵：<input type="text" name="features" value={formData.features} onChange={handleChange} /></label>
          </div>

          <div className="form-box">
            <label>圖片上傳：<input type="file" accept="image/*" onChange={handleImageUpload} /></label>
          </div>
        </div>
      );

    case 1:
      return (
        <div className="step-content">
          <div className="form-box">
            <label>類別：
              <select name="type" value={diseaseInput.type} onChange={handleDiseaseChange}>
                <option value="">請選擇</option>
                <option value="疾病">疾病</option>
                <option value="過敏">過敏</option>
              </select>
            </label>
            <label>名稱：<input name="name" value={diseaseInput.name} onChange={handleDiseaseChange} /></label>
            <label>狀態：
              <select name="status" value={diseaseInput.status} onChange={handleDiseaseChange}>
                <option value="">請選擇</option>
                <option value="待治療">待治療</option>
                <option value="治療中">治療中</option>
                <option value="已治療">已治療</option>
              </select>
            </label>
            <label>用藥：<input name="medication" value={diseaseInput.medication} onChange={handleDiseaseChange} /></label>
            <label>診斷日期：<input type="date" name="date" value={diseaseInput.date} onChange={handleDiseaseChange} /></label>
            <label>備註：<input name="note" value={diseaseInput.note} onChange={handleDiseaseChange} /></label>
            <button onClick={addDisease}>{diseaseInput.editIndex > -1 ? '儲存' : '新增'}</button>
          </div>

          <div className="record-box">
            {formData.diseases.map((item, i) => (
              <div key={i} className="record-row" onClick={() => editDisease(i)}>
                <span>{item.type}</span>
                <span>{item.name}</span>
                <span>{item.status}</span>
                <span onClick={(e) => { e.stopPropagation(); deleteDisease(i); }}>❌</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 2:
      return (
        <div className="step-content">
          <div className="form-box">
            <label>名稱：<input name="name" value={vaccineInput.name} onChange={handleVaccineChange} /></label>
            <label>疫苗種類：<button onClick={openVaccineModal}>選擇疫苗</button></label>
            <div className="tag-list">
              {vaccineInput.types.map((type, i) => (<span key={i} className="tag">{type}</span>))}
            </div>
            <label>施打日期：<input type="date" name="date" value={vaccineInput.date} onChange={handleVaccineChange} /></label>
            <label>備註：<input name="note" value={vaccineInput.note} onChange={handleVaccineChange} /></label>
            <button onClick={addVaccine}>{vaccineInput.editIndex > -1 ? '儲存' : '新增'}</button>
          </div>

          <div className="record-box">
            {formData.vaccines.map((item, i) => (
              <div key={i} className="record-row">
                <span>{item.name}</span>
                <span>{item.date}</span>
                <span onClick={() => deleteVaccine(i)}>❌</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 3:
      return (
        <div className="step-content">
          <div className="form-box">
            <h4>取得與來源</h4>
            <label>取得方式：
              <select onChange={(e) => setFormData(prev => ({ ...prev, contact: { ...prev.contact, method: e.target.value } }))}>
                <option>領養</option>
                <option>購買</option>
                <option>撿拾</option>
                <option>轉讓</option>
              </select>
            </label>
            <label>來源單位或個人：<input onChange={(e) => setFormData(prev => ({ ...prev, contact: { ...prev.contact, source: e.target.value } }))} /></label>
            <label>聯絡電話：<input onChange={(e) => setFormData(prev => ({ ...prev, contact: { ...prev.contact, phone: e.target.value } }))} /></label>
            <label>Email：<input onChange={(e) => setFormData(prev => ({ ...prev, contact: { ...prev.contact, email: e.target.value } }))} /></label>
            <label>地址：<input onChange={(e) => setFormData(prev => ({ ...prev, contact: { ...prev.contact, address: e.target.value } }))} /></label>
            <label>備註：<input onChange={(e) => setFormData(prev => ({ ...prev, contact: { ...prev.contact, note: e.target.value } }))} /></label>
          </div>

          <div className="form-box">
            <h4>晶片資訊</h4>
            <label>晶片號碼：<input onChange={(e) => setFormData(prev => ({ ...prev, chip: { ...prev.chip, code: e.target.value } }))} /></label>
            <label>植入日期：<input type="date" onChange={(e) => setFormData(prev => ({ ...prev, chip: { ...prev.chip, date: e.target.value } }))} /></label>
            <label>植入地點：<input onChange={(e) => setFormData(prev => ({ ...prev, chip: { ...prev.chip, location: e.target.value } }))} /></label>
          </div>
        </div>
      );

    case 4:
      return (
        <div className="step-content">
          <div className="form-box">
            <h4>通訊錄</h4>
            <button onClick={() => setAddressModal(true)}>新增</button>
            <div className="record-box">
              {formData.addressBook.map((item, i) => (
                <div key={i} className="record-row">
                  <input type="checkbox" onClick={() => deleteAddressEntry(i)} />
                  <span>{item.name}</span>
                  <span>{item.phone}</span>
                  <span>{item.note}</span>
                </div>
              ))}
            </div>
          </div>

          {addressModal && (
            <div className="modal">
              <label>名稱：<input onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))} /></label>
              <label>連絡電話：<input onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))} /></label>
              <label>Email：<input onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))} /></label>
              <label>地址：<input onChange={(e) => setNewContact(prev => ({ ...prev, address: e.target.value }))} /></label>
              <label>備註：<input onChange={(e) => setNewContact(prev => ({ ...prev, note: e.target.value }))} /></label>
              <button onClick={addAddressEntry}>確定</button>
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
};

  return (
    <div className="pet-history-container">
      <Header />
      <div className="main-content">
        <h2 className="page-title">寵物病史</h2>
        {renderProgress()}
        {renderStep()}
        <div className="button-group">
          <button className="save-btn" onClick={saveData}>儲存</button>
          {step < 4 && <button className="next-btn" onClick={() => setStep(step + 1)}>下一步</button>}
          {step === 4 && <button className="complete-btn">完成</button>}
        </div>
      </div>
      <BottomNavigationBar />
    </div>
  );
}