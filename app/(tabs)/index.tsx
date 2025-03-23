import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Switch,
  Vibration
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import uuid from 'react-native-uuid';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { Picker } from '@react-native-picker/picker';

const { width, height } = Dimensions.get('window');

// ENUMS ve INTERFACES
// Bildirim kategorileri
const ReportCategory = {
  INFRASTRUCTURE: 'Altyapı',
  ENVIRONMENT: 'Çevre ve Temizlik',
  SECURITY: 'Güvenlik',
  TRAFFIC: 'Trafik',
  WASTE: 'Atık ve Çöp',
  OTHER: 'Diğer'
};

// Bildirim durumları
const ReportStatus = {
  PENDING: 'Beklemede',
  REVIEWING: 'İnceleniyor',
  IN_PROGRESS: 'Çözüm Süreci',
  RESOLVED: 'Çözüldü',
  REJECTED: 'Reddedildi'
};

// SecureStore için anahtarlar
const PERSONAL_INFO_STORAGE_KEY = 'personal_info';
const REPORTS_STORAGE_KEY = 'reports';

// Ana uygulama
export default function App() {
  // STATE YÖNETİMİ
  const [query, setQuery] = useState('');
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ReportCategory.INFRASTRUCTURE);
  const [otherCategoryText, setOtherCategoryText] = useState('');
  // UI States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTab, setCurrentTab] = useState('new');
  const [showPersonalInfoModal, setShowPersonalInfoModal] = useState(false);
  const [showReportDetailModal, setShowReportDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Refs
  const mapRef = useRef(null);
  const scrollViewRef = useRef(null);
  
  // Kişisel bilgiler
  const [personalInfo, setPersonalInfo] = useState({
    name: '',
    surname: '',
    email: '',
    phone: '',
    contactPreference: 'email',
    preferredTime: 'workHours'
  });
  
  // Bildirimler
  const [reports, setReports] = useState([]);
  
  // İstatistikler
  const [statistics, setStatistics] = useState({
    totalReports: 0,
    resolvedReports: 0,
    pendingReports: 0,
    categoryBreakdown: Object.values(ReportCategory).reduce((acc, cat) => {
      acc[cat] = 0;
      return acc;
    }, {}),
    monthlyReports: []
  });
  
  // Tema renklerini belirle
  const theme = {
    background: isDarkMode ? '#121212' : '#f8f9fa',
    card: isDarkMode ? '#1E1E1E' : '#ffffff',
    text: isDarkMode ? '#FFFFFF' : '#344955',
    textSecondary: isDarkMode ? '#B0B0B0' : '#4A6572',
    primary: isDarkMode ? '#BB86FC' : '#344955',
    secondary: isDarkMode ? '#03DAC6' : '#4A6572',
    accent: isDarkMode ? '#CF6679' : '#F9AA33',
    border: isDarkMode ? '#2d2d2d' : '#e9ecef',
    statusColors: {
      [ReportStatus.PENDING]: '#FFC107',
      [ReportStatus.REVIEWING]: '#2196F3',
      [ReportStatus.IN_PROGRESS]: '#9C27B0',
      [ReportStatus.RESOLVED]: '#4CAF50',
      [ReportStatus.REJECTED]: '#F44336'
    }
  };

  // YAŞAM DÖNGÜSÜ & EFEKTLERİ
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      
      try {
        // İzinleri al
        const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
        if (locationStatus === 'granted') {
          await getCurrentLocation();
        }

        // Cihaz bilgilerini al
        setDeviceInfo({
          model: Device.modelName || 'Bilinmiyor',
          osVersion: Device.osVersion || 'Bilinmiyor',
          deviceId: Device.osInternalBuildId || 'Bilinmiyor'
        });
        
        // Kullanıcı kaydı kontrolü
        const savedInfo = await SecureStore.getItemAsync(PERSONAL_INFO_STORAGE_KEY);
        
        if (savedInfo) {
          // Kayıtlı kullanıcı bulundu
          setPersonalInfo(JSON.parse(savedInfo));
          setIsLoggedIn(true);
          
          // Raporları yükle
          await loadReports();
        } else {
          // Kayıtlı kullanıcı bulunamadı - login ekranı göster
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.log('Başlatma hatası:', error);
        Alert.alert('Hata', 'Uygulama başlatılırken bir hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);
  
  // İstatistikleri hesapla
  useEffect(() => {
    if (reports.length > 0) {
      calculateStatistics();
    }
  }, [reports]);
  
  // YARDIMCI FONKSİYONLAR
  
  // Raporları yükle
  const loadReports = async () => {
    try {
      setIsLoading(true);
      const savedReports = await SecureStore.getItemAsync(REPORTS_STORAGE_KEY);
      if (savedReports) {
        const loadedReports = JSON.parse(savedReports);
        setReports(loadedReports);
      }
    } catch (error) {
      console.error('Raporlar yüklenirken hata:', error);
      Alert.alert('Hata', 'Raporlar yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Raporları kaydet
  const saveReports = async (updatedReports) => {
    try {
      await SecureStore.setItemAsync(REPORTS_STORAGE_KEY, JSON.stringify(updatedReports));
    } catch (error) {
      console.error('Raporlar kaydedilirken hata:', error);
      Alert.alert('Hata', 'Raporlar kaydedilirken bir hata oluştu.');
    }
  };
  
  // İstatistikleri hesapla
  const calculateStatistics = () => {
    // Toplam ve durum bazlı sayılar
    const totalReports = reports.length;
    const resolvedReports = reports.filter(r => r.status === ReportStatus.RESOLVED).length;
    const pendingReports = reports.filter(r => r.status !== ReportStatus.RESOLVED).length;
    
    // Kategori dağılımı
    const categoryBreakdown = {};
    Object.values(ReportCategory).forEach(category => {
      categoryBreakdown[category] = reports.filter(r => r.category === category).length;
    });
    
    // Aylık raporlar
    const monthsMap = {};
    reports.forEach(report => {
      const date = new Date(report.createdAt);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      monthsMap[monthYear] = (monthsMap[monthYear] || 0) + 1;
    });
    
    const monthlyReports = Object.entries(monthsMap).map(([month, count]) => ({ month, count }));
    
    setStatistics({
      totalReports,
      resolvedReports,
      pendingReports,
      categoryBreakdown,
      monthlyReports
    });
  };
  
  // Kişisel bilgileri kaydet ve giriş yap
  const handleLogin = async () => {
    // Form doğrulaması
    if (!personalInfo.name.trim() || !personalInfo.surname.trim()) {
      Alert.alert('Uyarı', 'Ad ve soyad alanları zorunludur.');
      return;
    }

    if (personalInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)) {
      Alert.alert('Uyarı', 'Geçerli bir e-posta adresi girin.');
      return;
    }

    if (personalInfo.phone && personalInfo.phone.replace(/[^0-9]/g, '').length !== 10) {
      Alert.alert('Uyarı', 'Geçerli bir Türk telefon numarası girin (örn: 5XX XXX XX XX).');
      return;
    }

    try {
      setIsLoading(true);
      // Kişisel bilgileri kaydet
      await SecureStore.setItemAsync(PERSONAL_INFO_STORAGE_KEY, JSON.stringify(personalInfo));
      setIsLoggedIn(true);
      
      // Hoş geldiniz mesajı
      speak(`Hoş geldiniz ${personalInfo.name}`);
      Vibration.vibrate(200);
    } catch (error) {
      console.log('Kişisel bilgileri kaydederken hata:', error);
      Alert.alert('Hata', 'Kişisel bilgiler kaydedilemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Kişisel bilgileri güncelle
  const handlePersonalInfoUpdate = async () => {
    // Form doğrulaması
    if (!personalInfo.name.trim() || !personalInfo.surname.trim()) {
      Alert.alert('Uyarı', 'Ad ve soyad alanları zorunludur.');
      return;
    }

    if (personalInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email)) {
      Alert.alert('Uyarı', 'Geçerli bir e-posta adresi girin.');
      return;
    }

    if (personalInfo.phone && personalInfo.phone.replace(/[^0-9]/g, '').length !== 10) {
      Alert.alert('Uyarı', 'Geçerli bir Türk telefon numarası girin (örn: 5XX XXX XX XX).');
      return;
    }

    try {
      setIsLoading(true);
      await SecureStore.setItemAsync(PERSONAL_INFO_STORAGE_KEY, JSON.stringify(personalInfo));
      setShowPersonalInfoModal(false);
      Alert.alert('Bilgi', 'Kişisel bilgileriniz başarıyla güncellendi.');
      
      // Haptic feedback
      Vibration.vibrate(100);
    } catch (error) {
      console.log('Kişisel bilgileri güncellerken hata:', error);
      Alert.alert('Hata', 'Kişisel bilgiler güncellenemedi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Çıkış yap - kişisel bilgileri sil
  const handleLogout = async () => {
    Alert.alert(
      "Çıkış Yap",
      "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Çıkış Yap", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await SecureStore.deleteItemAsync(PERSONAL_INFO_STORAGE_KEY);
              setPersonalInfo({
                name: '',
                surname: '',
                email: '',
                phone: '',
                contactPreference: 'email',
                preferredTime: 'workHours'
              });
              setIsLoggedIn(false);
              
              // Haptic feedback
              Vibration.vibrate([100, 200, 300]);
            } catch (error) {
              console.log('Çıkış yaparken hata:', error);
              Alert.alert('Hata', 'Çıkış yapılırken bir sorun oluştu.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };
  // Konum alma
  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });
      setLocation(loc.coords);
      setSelectedLocation(loc.coords);
      
      // Konumun adres bilgisini al
      const address = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      
      if (address && address.length > 0) {
        const addr = address[0];
        const locationString = `${addr.street || ''} ${addr.name || ''}, ${addr.district || ''}, ${addr.city || ''}, ${addr.country || ''}`;
        setManualAddress(locationString.trim());
        setLocationName(locationString.trim());
      }
      
      // Haptic feedback
      Vibration.vibrate(50);
    } catch (error) {
      console.log('Konum alma hatası:', error);
      Alert.alert('Hata', 'Konumunuz alınamadı. Lütfen konum servislerini kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Görsel seçimi veya çekimi
  const pickImage = async (sourceType) => {
    try {
      if (sourceType === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Kamera erişimi için izin gerekiyor.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          base64: true,
          quality: 0.7,
          exif: true
        });
        if (!result.canceled) {
          addImageToState(result);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Galeri erişimi için izin gerekiyor.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          base64: true,
          quality: 0.7,
          exif: true,
          allowsMultipleSelection: true,
          selectionLimit: 5
        });
        if (!result.canceled) {
          addImageToState(result);
        }
      }
    } catch (error) {
      Alert.alert('Hata', 'Görsel seçilirken bir hata oluştu.');
    }
  };

  // Görsel önizleme
  const handleImagePreview = (uri) => {
    setPreviewImage(uri);
    setShowImagePreview(true);
  };

  // Görsel ekle
  const addImageToState = (result) => {
    const assets = result.assets ? result.assets : [result];

    const newImages = assets.map(asset => ({
      image_id: uuid.v4(),
      filename: asset.uri.split('/').pop(),
      image_base64: asset.base64,
      uri: asset.uri,
      metadata: {
        latitude: selectedLocation ? selectedLocation.latitude : null,
        longitude: selectedLocation ? selectedLocation.longitude : null,
        timestamp: new Date().toISOString(),
        device: deviceInfo.model || 'Bilinmiyor',
        os_version: deviceInfo.osVersion || 'Bilinmiyor',
        address: manualAddress || 'Bilinmiyor',
      }
    }));

    setImages([...images, ...newImages]);
    
    // Haptic feedback
    Vibration.vibrate(50);
  };

  // Görsel kaldır
  const removeImage = (imageId) => {
    setImages(images.filter(img => img.image_id !== imageId));
    Vibration.vibrate(100);
  };

  // Harita lokasyonu seçme
  const handleMapLocationSelect = (event) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);
    
    // Seçilen konumun adresini bul
    Location.reverseGeocodeAsync(coordinate).then(address => {
      if (address && address.length > 0) {
        const addr = address[0];
        const locationString = `${addr.street || ''} ${addr.name || ''}, ${addr.district || ''}, ${addr.city || ''}, ${addr.country || ''}`;
        setManualAddress(locationString.trim());
        setLocationName(locationString.trim());
      }
    }).catch(error => {
      console.log('Adres çözümleme hatası:', error);
    });
    
    // Haptic feedback
    Vibration.vibrate(50);
  };

  // Türk telefon numarası formatı kontrolü
  const handlePhoneChange = (text) => {
    // Sadece rakamları al
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Maksimum 10 rakam (Türk telefon numarası)
    if (numericValue.length <= 10) {
      // Biçimlendirilmiş telefon numarası
      let formattedNumber = '';
      
      if (numericValue.length > 0) {
        formattedNumber += numericValue.substring(0, Math.min(3, numericValue.length));
        
        if (numericValue.length > 3) {
          formattedNumber += ' ' + numericValue.substring(3, Math.min(6, numericValue.length));
          
          if (numericValue.length > 6) {
            formattedNumber += ' ' + numericValue.substring(6, Math.min(8, numericValue.length));
            
            if (numericValue.length > 8) {
              formattedNumber += ' ' + numericValue.substring(8, 10);
            }
          }
        }
      }
      
      setPersonalInfo({...personalInfo, phone: formattedNumber});
    }
  };

  // Form doğrulama
  const validateForm = () => {
    if (!query.trim()) {
      Alert.alert('Uyarı', 'Lütfen sorununuzu/talebinizi girin.');
      return false;
    }

    // Kategori kontrolü
    if (!selectedCategory) {
      Alert.alert('Uyarı', 'Lütfen bir kategori seçin.');
      return false;
    }

    // Konum kontrolü
    if (!selectedLocation) {
      Alert.alert('Uyarı', 'Lütfen konumunuzu belirtin.');
      return false;
    }

    // Kişisel bilgiler zaten kaydedilmiş olmalı
    if (!isLoggedIn || !personalInfo.name || !personalInfo.surname) {
      Alert.alert('Uyarı', 'Kişisel bilgileriniz eksik. Lütfen ayarlardan kişisel bilgilerinizi güncelleyin.');
      return false;
    }

    return true;
  };

  // Bildirim gönder
  const handleSubmit = async () => {
    if (!validateForm()) return;
  
    try {
      setIsLoading(true);
      
      // Yeni bildirim oluştur
      const newReport = {
        id: uuid.v4().toString(),
        query: query,
        category: selectedCategory,
        otherCategoryText: selectedCategory === ReportCategory.OTHER ? otherCategoryText : null,
        status: ReportStatus.PENDING,
        images: images,
        location: selectedLocation ? {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          address: manualAddress || 'Belirtilmemiş'
        } : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userInfo: {
          name: personalInfo.name,
          surname: personalInfo.surname,
          contactPreference: personalInfo.contactPreference
        }
      };
      
      // Bildirim ekle
      const updatedReports = [...reports, newReport];
      setReports(updatedReports);
      
      // Raporları kaydet
      await saveReports(updatedReports);
      
      // Başarı bildirimi
      setSuccessMessage('Bildiriminiz başarıyla gönderildi!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Sesli bildirim
      speak('Bildiriminiz başarıyla gönderildi!');
      
      // Titreşim geri bildirimi
      Vibration.vibrate([100, 200, 100, 200]);
      
      // Form temizleme sorgu
      Alert.alert(
        "Teşekkürler!",
        "Bildiriminiz başarıyla alındı. En kısa sürede incelenecektir.",
        [{ text: "Tamam", onPress: () => clearForm() }]
      );
      
    } catch (error) {
      console.error('Bildirim gönderme hatası:', error);
      Alert.alert('Hata', 'Bildiriminiz gönderilemedi. Lütfen daha sonra tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  // Formu temizle
  const clearForm = () => {
    setQuery('');
    setImages([]);
    setManualAddress('');
    setLocationName('');
    setSelectedCategory(ReportCategory.INFRASTRUCTURE);
    setCurrentTab('new');
  };

  // Görsel seçenekleri göster
  const showImageOptions = () => {
    Alert.alert(
      "Görsel Ekle",
      "Görsel kaynağını seçin",
      [
        { text: "Kamera", onPress: () => pickImage('camera') },
        { text: "Galeri", onPress: () => pickImage('gallery') },
        { text: "İptal", style: "cancel" }
      ]
    );
  };

  // Kişisel bilgileri düzenle
  const handleEditPersonalInfo = () => {
    setShowPersonalInfoModal(true);
  };
  
  // Bildirim detaylarını göster
  const showReportDetail = (report) => {
    setSelectedReport(report);
    setShowReportDetailModal(true);
    
    // Sesli okuma
    if (speakEnabled) {
      speak(`Bildirim: ${report.query}. Kategori: ${report.category}. Durum: ${report.status}.`);
    }
  };
  
  // Sesli komut sistemi
  const speak = (text) => {
    Speech.speak(text, {
      language: 'tr-TR',
      pitch: 1.0,
      rate: 0.9
    });
  };
  
  // Sesli komutu durdur
  const stopSpeaking = () => {
    Speech.stop();
  };
  
  // Harita Modal
  const renderMapModal = () => {
    return (
      <Modal
        visible={showMap}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowMap(false)}
      >
        <SafeAreaView style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <Text style={[styles.mapTitle, {color: theme.text}]}>Konum Seçin</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowMap(false)}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          {selectedLocation && (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              onPress={handleMapLocationSelect}
            >
              <Marker
                coordinate={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude
                }}
                draggable
                onDragEnd={handleMapLocationSelect}
              />
            </MapView>
          )}
          
          <View style={styles.mapAddressContainer}>
            <Text style={[styles.mapAddressTitle, {color: theme.text}]}>Seçilen Konum:</Text>
            <Text style={[styles.mapAddress, {color: theme.textSecondary}]}>
              {locationName || "Konum seçilmedi"}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.confirmLocationButton, {backgroundColor: theme.primary}]}
            onPress={() => setShowMap(false)}
          >
            <Text style={styles.confirmLocationText}>Bu Konumu Kullan</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  };
  // RENDER FONKSİYONLARI
  
  // Görsel önizleme modalı
  const renderImagePreviewModal = () => {
    return (
      <Modal
        visible={showImagePreview}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImagePreview(false)}
      >
        <View style={styles.imagePreviewContainer}>
          <TouchableOpacity 
            style={styles.imagePreviewCloseButton}
            onPress={() => setShowImagePreview(false)}
          >
            <Ionicons name="close-circle" size={36} color="#FFFFFF" />
          </TouchableOpacity>
          
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    );
  };
  
  // Bildirim detayları modalı
  const renderReportDetailModal = () => {
    if (!selectedReport) return null;
    
    return (
      <Modal
        visible={showReportDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportDetailModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, {backgroundColor: theme.card}]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: theme.text}]}>
                Bildirim Detayları
              </Text>
              <TouchableOpacity onPress={() => setShowReportDetailModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.statusContainer}>
                <Text style={[styles.statusLabel, {color: theme.textSecondary}]}>Durum:</Text>
                <View style={[
                  styles.statusBadge, 
                  {backgroundColor: theme.statusColors[selectedReport.status]}
                ]}>
                  <Text style={styles.statusText}>{selectedReport.status}</Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, {color: theme.textSecondary}]}>Kategori:</Text>
                <Text style={[styles.detailValue, {color: theme.text}]}>{selectedReport.category}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, {color: theme.textSecondary}]}>Tarih:</Text>
                <Text style={[styles.detailValue, {color: theme.text}]}>
                  {new Date(selectedReport.createdAt).toLocaleDateString('tr-TR')}
                </Text>
              </View>
              
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, {color: theme.text}]}>Bildirim İçeriği</Text>
                <Text style={[styles.detailText, {color: theme.text}]}>{selectedReport.query}</Text>
              </View>
              
              {selectedReport.location && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, {color: theme.text}]}>Konum</Text>
                  <Text style={[styles.detailText, {color: theme.text}]}>{selectedReport.location.address}</Text>
                  
                  <View style={styles.miniMapContainer}>
                    <MapView
                      style={styles.miniMap}
                      initialRegion={{
                        latitude: selectedReport.location.latitude,
                        longitude: selectedReport.location.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                    >
                      <Marker
                        coordinate={{
                          latitude: selectedReport.location.latitude,
                          longitude: selectedReport.location.longitude
                        }}
                      />
                    </MapView>
                  </View>
                </View>
              )}
              
              {selectedReport.images && selectedReport.images.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailSectionTitle, {color: theme.text}]}>Görseller</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageGallery}>
                    {selectedReport.images.map((img) => (
                      <TouchableOpacity 
                        key={img.image_id} 
                        onPress={() => handleImagePreview(img.uri)}
                        style={styles.galleryImageContainer}
                      >
                        <Image
                          source={{ uri: img.uri }}
                          style={styles.galleryImage}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.modalButton, {backgroundColor: theme.primary}]}
              onPress={() => setShowReportDetailModal(false)}
            >
              <Text style={styles.modalButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };
  
  // Giriş/Kayıt Ekranı
  const renderLoginScreen = () => {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#344955" />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.loginKeyboardView}
        >
          <ScrollView contentContainerStyle={styles.loginScrollContainer}>
            <View style={styles.logoContainer}>
              <Ionicons name="notifications" size={60} color="#FFFFFF" />
              <Text style={styles.logoText}>Manisa Büyükşehir</Text>
              <Text style={styles.logoText}>Bildirim Sistemi</Text>
              <Text style={styles.logoSubText}>Sorunlarınızı bildirebilmeniz için giriş yapın</Text>
            </View>
            
            <View style={styles.loginFormContainer}>
              <Text style={styles.loginFormTitle}>Giriş Yap / Kayıt Ol</Text>
              
              <View style={styles.loginInputContainer}>
                <Ionicons name="person-outline" size={20} color="#4A6572" style={styles.loginInputIcon} />
                <TextInput
                  placeholder="Adınız"
                  value={personalInfo.name}
                  onChangeText={(text) => setPersonalInfo({...personalInfo, name: text})}
                  style={styles.loginInput}
                  placeholderTextColor="#adb5bd"
                />
              </View>

              <View style={styles.loginInputContainer}>
                <Ionicons name="person-outline" size={20} color="#4A6572" style={styles.loginInputIcon} />
                <TextInput
                  placeholder="Soyadınız"
                  value={personalInfo.surname}
                  onChangeText={(text) => setPersonalInfo({...personalInfo, surname: text})}
                  style={styles.loginInput}
                  placeholderTextColor="#adb5bd"
                />
              </View>

              <View style={styles.loginInputContainer}>
                <Ionicons name="mail-outline" size={20} color="#4A6572" style={styles.loginInputIcon} />
                <TextInput
                  placeholder="E-posta Adresiniz"
                  value={personalInfo.email}
                  onChangeText={(text) => setPersonalInfo({...personalInfo, email: text})}
                  keyboardType="email-address"
                  style={styles.loginInput}
                  placeholderTextColor="#adb5bd"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.loginInputContainer}>
                <Ionicons name="call-outline" size={20} color="#4A6572" style={styles.loginInputIcon} />
                <TextInput
                  placeholder="(5XX XXX XX XX)"
                  value={personalInfo.phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  style={styles.loginInput}
                  placeholderTextColor="#adb5bd"
                  maxLength={13}
                />
              </View>
              
              {/* İletişim Tercihleri */}
              <View style={styles.preferenceContainer}>
                <Text style={styles.preferenceTitle}>Size nasıl ulaşalım?</Text>
                
                <View style={styles.radioGroup}>
                  <TouchableOpacity 
                    style={styles.radioOption}
                    onPress={() => setPersonalInfo({...personalInfo, contactPreference: 'email'})}
                  >
                    <View style={[
                      styles.radioButton, 
                      personalInfo.contactPreference === 'email' && styles.radioButtonSelected
                    ]}>
                      {personalInfo.contactPreference === 'email' && 
                        <View style={styles.radioButtonInner} />
                      }
                    </View>
                    <Text style={styles.radioText}>E-posta</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.radioOption}
                    onPress={() => setPersonalInfo({...personalInfo, contactPreference: 'phone'})}
                  >
                    <View style={[
                      styles.radioButton, 
                      personalInfo.contactPreference === 'phone' && styles.radioButtonSelected
                    ]}>
                      {personalInfo.contactPreference === 'phone' && 
                        <View style={styles.radioButtonInner} />
                      }
                    </View>
                    <Text style={styles.radioText}>Telefon</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.radioOption}
                    onPress={() => setPersonalInfo({...personalInfo, contactPreference: 'sms'})}
                  >
                    <View style={[
                      styles.radioButton, 
                      personalInfo.contactPreference === 'sms' && styles.radioButtonSelected
                    ]}>
                      {personalInfo.contactPreference === 'sms' && 
                        <View style={styles.radioButtonInner} />
                      }
                    </View>
                    <Text style={styles.radioText}>SMS</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
{/* Tercih edilen zaman - sadece telefon seçildiğinde göster */}
{personalInfo.contactPreference === 'phone' && (
  <View style={styles.preferenceContainer}>
    <Text style={styles.preferenceTitle}>Ne zaman aranmak istersiniz?</Text>
    
    <View style={styles.radioGroup}>
      <TouchableOpacity 
        style={styles.radioOption}
        onPress={() => setPersonalInfo({...personalInfo, preferredTime: 'workHours'})}
      >
        <View style={[
          styles.radioButton, 
          personalInfo.preferredTime === 'workHours' && styles.radioButtonSelected
        ]}>
          {personalInfo.preferredTime === 'workHours' && 
            <View style={styles.radioButtonInner} />
          }
        </View>
        <Text style={styles.radioText}>Mesai Saatleri (9:00-17:00)</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.radioOption}
        onPress={() => setPersonalInfo({...personalInfo, preferredTime: 'evening'})}
      >
        <View style={[
          styles.radioButton, 
          personalInfo.preferredTime === 'evening' && styles.radioButtonSelected
        ]}>
          {personalInfo.preferredTime === 'evening' && 
            <View style={styles.radioButtonInner} />
          }
        </View>
        <Text style={styles.radioText}>Akşam Saatleri (17:00-21:00)</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.radioOption}
        onPress={() => setPersonalInfo({...personalInfo, preferredTime: 'anytime'})}
      >
        <View style={[
          styles.radioButton, 
          personalInfo.preferredTime === 'anytime' && styles.radioButtonSelected
        ]}>
          {personalInfo.preferredTime === 'anytime' && 
            <View style={styles.radioButtonInner} />
          }
        </View>
        <Text style={styles.radioText}>Herhangi bir zaman</Text>
      </TouchableOpacity>
    </View>
  </View>
)}
              
              {/* Erişilebilirlik Ayarı */}
              <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Koyu tema</Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={(value) => setIsDarkMode(value)}
                  trackColor={{ false: "#767577", true: "#4A6572" }}
                  thumbColor={isDarkMode ? "#344955" : "#f4f3f4"}
                  ios_backgroundColor="#3e3e3e"
                />
              </View>

              <TouchableOpacity 
                style={styles.loginButton}
                onPress={handleLogin}
              >
                <Text style={styles.loginButtonText}>Giriş Yap</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              
              <Text style={styles.loginInfo}>
                * Bu bilgiler sadece sizinle iletişime geçebilmemiz için kullanılacaktır.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  };
  
  // ANA EKRAN RENDER
  // Yükleniyor göstergesi
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Yükleniyor...
        </Text>
      </View>
    );
  }
  
  // Login/Kayıt ekranı
  if (!isLoggedIn) {
    return renderLoginScreen();
  }
  
  // Ana ekran render
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      
      {/* Success Message */}
      {successMessage ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
          <Text style={styles.successBannerText}>{successMessage}</Text>
        </View>
      ) : null}
      
      {/* Modallar */}
      {renderMapModal()}
      {renderImagePreviewModal()}
      {renderReportDetailModal()}
      
      {/* Kişisel Bilgi Modalı */}
      <Modal
        visible={showPersonalInfoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPersonalInfoModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, {backgroundColor: theme.card}]}>
            <Text style={[styles.modalTitle, {color: theme.text}]}>
              Kişisel Bilgilerinizi Düzenleyin
            </Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Adınız"
                value={personalInfo.name}
                onChangeText={(text) => setPersonalInfo({...personalInfo, name: text})}
                style={[styles.input, {color: theme.text}]}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Soyadınız"
                value={personalInfo.surname}
                onChangeText={(text) => setPersonalInfo({...personalInfo, surname: text})}
                style={[styles.input, {color: theme.text}]}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder="email@example.com"
                value={personalInfo.email}
                onChangeText={(text) => setPersonalInfo({...personalInfo, email: text})}
                keyboardType="email-address"
                style={[styles.input, {color: theme.text}]}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder="5XX XXX XX XX"
                value={personalInfo.phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                style={[styles.input, {color: theme.text}]}
                placeholderTextColor={theme.textSecondary}
                maxLength={13}
              />
            </View>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={[styles.modalUpdateButton, {backgroundColor: theme.primary}]}
                onPress={handlePersonalInfoUpdate}
              >
                <Text style={styles.submitButtonText}>Güncelle</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalCancelButton, {backgroundColor: theme.background}]}
                onPress={() => setShowPersonalInfoModal(false)}
              >
                <Text style={[styles.cancelButtonText, {color: theme.textSecondary}]}>İptal</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#FF4D4D" />
              <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            currentTab === 'new' && [styles.activeTab, {borderColor: theme.primary}]
          ]}
          onPress={() => setCurrentTab('new')}
        >
          <Ionicons 
            name="add-circle" 
            size={20} 
            color={currentTab === 'new' ? theme.primary : theme.textSecondary} 
          />
          <Text style={[
            styles.tabText, 
            {color: currentTab === 'new' ? theme.primary : theme.textSecondary}
          ]}>
            Yeni Bildirim
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            currentTab === 'history' && [styles.activeTab, {borderColor: theme.primary}]
          ]}
          onPress={() => setCurrentTab('history')}
        >
          <Ionicons 
            name="time" 
            size={20} 
            color={currentTab === 'history' ? theme.primary : theme.textSecondary} 
          />
          <Text style={[
            styles.tabText, 
            {color: currentTab === 'history' ? theme.primary : theme.textSecondary}
          ]}>
            Geçmiş
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            currentTab === 'stats' && [styles.activeTab, {borderColor: theme.primary}]
          ]}
          onPress={() => setCurrentTab('stats')}
        >
          <Ionicons 
            name="stats-chart" 
            size={20} 
            color={currentTab === 'stats' ? theme.primary : theme.textSecondary} 
          />
          <Text style={[
            styles.tabText, 
            {color: currentTab === 'stats' ? theme.primary : theme.textSecondary}
          ]}>
            İstatistikler
          </Text>
        </TouchableOpacity>
      </View>
        
      {/* Yeni Bildirim Sekmesi */}
      {currentTab === 'new' && (
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={[styles.headerTitle, {color: theme.text}]}>
                Bildirim Formu
              </Text>
              <TouchableOpacity onPress={handleEditPersonalInfo} style={styles.settingsButton}>
                <Ionicons name="settings-outline" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.headerSubtitle, {color: theme.textSecondary}]}>
              Sorununuzu bildirin, biz ilgilenelim.
            </Text>
            <View style={[styles.userInfoBadge, {backgroundColor: theme.background}]}>
              <Ionicons name="person" size={16} color={theme.textSecondary} />
              <Text style={[styles.userInfoText, {color: theme.textSecondary}]}>
                {personalInfo.name} {personalInfo.surname}
              </Text>
            </View>
          </View>

          <View style={[styles.formSection, {backgroundColor: theme.card}]}>
            <Text style={[styles.sectionTitle, {color: theme.text}]}>
              Sorununuz
            </Text>

            <View style={styles.queryInputContainer}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Örneğin: Sokak lambası arızalı"
                value={query}
                onChangeText={setQuery}
                style={[styles.queryInput, {color: theme.text}]}
                placeholderTextColor={theme.textSecondary}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            
            <Text style={[styles.sectionTitle, {color: theme.text}]}>Kategori Seçin</Text>

<View style={styles.categoryButtonsContainer}>
  {Object.values(ReportCategory).map((category) => (
    <TouchableOpacity
      key={category}
      style={[
        styles.categoryButton,
        selectedCategory === category ? {backgroundColor: theme.primary} : {backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1}
      ]}
      onPress={() => setSelectedCategory(category)}
    >
      <Text 
        style={[
          styles.categoryButtonText, 
          {color: selectedCategory === category ? '#ffffff' : theme.text}
        ]}
      >
        {category}
      </Text>
    </TouchableOpacity>
  ))}
</View>

{/* Diğer seçeneği için açıklama alanı */}
{selectedCategory === ReportCategory.OTHER && (
  <View style={{marginTop: 10, marginBottom: 5}}>
    <TextInput
      placeholder="Lütfen kategorinizi açıklayın..."
      value={otherCategoryText}
      onChangeText={setOtherCategoryText}
      style={{
        backgroundColor: theme.background,
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16
      }}
      placeholderTextColor={theme.textSecondary}
    />
  </View>
)}
</View>

          <View style={[styles.formSection, {backgroundColor: theme.card}]}>
            <Text style={[styles.sectionTitle, {color: theme.text}]}>
              Konum Bilgisi
            </Text>
            <Text style={[styles.sectionSubtitle, {color: theme.textSecondary}]}>
              Bildiriminizle ilgili konum bilgisi
            </Text>
            
            <View style={styles.locationInputContainer}>
              <Ionicons name="location-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Konum bilgisi..."
                value={manualAddress}
                onChangeText={setManualAddress}
                style={[styles.locationInput, {color: theme.text}]}
                placeholderTextColor={theme.textSecondary}
                editable={false}
              />
            </View>
            
            <View style={styles.locationButtonsContainer}>
              <TouchableOpacity 
                style={[styles.locationButton, {backgroundColor: theme.primary}]}
                onPress={getCurrentLocation}
              >
                <Ionicons name="navigate" size={20} color="#ffffff" />
                <Text style={styles.locationButtonText}>Konumumu Al</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.locationButton, {backgroundColor: theme.primary}]}
                onPress={() => setShowMap(true)}
              >
                <Ionicons name="map" size={20} color="#ffffff" />
                <Text style={styles.locationButtonText}>Haritadan Seç</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.formSection, {backgroundColor: theme.card}]}>
            <Text style={[styles.sectionTitle, {color: theme.text}]}>
              Görseller
            </Text>
            <Text style={[styles.sectionSubtitle, {color: theme.textSecondary}]}>
              Durumu daha iyi anlamamız için görsel ekleyebilirsiniz
            </Text>

            <TouchableOpacity
              style={[styles.imageButton, {backgroundColor: theme.primary}]}
              onPress={showImageOptions}
            >
              <Ionicons name="camera-outline" size={24} color="#ffffff" />
              <Text style={styles.imageButtonText}>Görsel Ekle</Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <View style={styles.imagesContainer}>
                {images.map((img) => (
                  <View key={img.image_id} style={styles.imageCard}>
                    <TouchableOpacity onPress={() => handleImagePreview(img.uri)}>
                      <Image
                        source={{ uri: img.uri }}
                        style={styles.imagePreview}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(img.image_id)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ff4d4f" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, {backgroundColor: theme.primary}]}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>Gönder</Text>
            <Ionicons name="paper-plane-outline" size={20} color="#ffffff" style={styles.submitIcon} />
          </TouchableOpacity>
        </ScrollView>
      )}
      
      {/* Bildirim Geçmişi Sekmesi */}
      {currentTab === 'history' && (
        <View style={styles.historyContainer}>
          <View style={[styles.historyHeader, {backgroundColor: theme.card}]}>
            <Text style={[styles.historyTitle, {color: theme.text}]}>
              Bildirim Geçmişiniz
            </Text>
            <TouchableOpacity 
              style={[styles.speakButton, speakEnabled && {backgroundColor: theme.primary}]}
              onPress={() => {
                if (speakEnabled) {
                  stopSpeaking();
                  setSpeakEnabled(false);
                } else {
                  setSpeakEnabled(true);
                  speak('Sesli okuma etkinleştirildi. Bildirim detaylarını görmek için bir bildirime dokunun.');
                }
              }}
            >
              <Ionicons 
                name={speakEnabled ? "volume-high" : "volume-mute"} 
                size={22} 
                color={speakEnabled ? "#FFFFFF" : theme.textSecondary} 
              />
            </TouchableOpacity>
          </View>
          
          {reports.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="document-outline" size={60} color={theme.textSecondary} />
              <Text style={[styles.emptyStateText, {color: theme.text}]}>
                Henüz bildiriminiz bulunmuyor.
              </Text>
              <Text style={[styles.emptyStateSubText, {color: theme.textSecondary}]}>
                Bir sorun bildirmek için "Yeni Bildirim" sekmesini kullanabilirsiniz.
              </Text>
            </View>
          ) : (
            <FlatList
              data={reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.reportCard, {backgroundColor: theme.card}]}
                  onPress={() => showReportDetail(item)}
                >
                  <View style={styles.reportHeader}>
                    <View style={styles.reportCategory}>
                      <MaterialIcons 
                        name={
                          item.category === ReportCategory.INFRASTRUCTURE ? "construction" :
                          item.category === ReportCategory.ENVIRONMENT ? "nature" :
                          item.category === ReportCategory.SECURITY ? "security" :
                          item.category === ReportCategory.TRAFFIC ? "traffic" :
                          item.category === ReportCategory.WASTE ? "delete" :
                          "help"
                        } 
                        size={20} 
                        color={theme.textSecondary} 
                      />
                      <Text style={[styles.reportCategoryText, {color: theme.textSecondary}]}>
                        {item.category}
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.reportStatusBadge, 
                      {backgroundColor: theme.statusColors[item.status]}
                    ]}>
                      <Text style={styles.reportStatusText}>{item.status}</Text>
                    </View>
                  </View>
                  
                  <Text 
                    style={[styles.reportText, {color: theme.text}]}
                    numberOfLines={2}
                  >
                    {item.query}
                  </Text>
                  
                  <View style={styles.reportFooter}>
                    <Text style={[styles.reportDate, {color: theme.textSecondary}]}>
                      {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                    </Text>
                    
                    <View style={styles.reportMeta}>
                      {item.images && item.images.length > 0 && (
                        <View style={styles.reportMetaItem}>
                          <Ionicons name="image-outline" size={14} color={theme.textSecondary} />
                          <Text style={[styles.reportMetaText, {color: theme.textSecondary}]}>
                            {item.images.length}
                          </Text>
                        </View>
                      )}
                      
                      {item.location && (
                        <View style={styles.reportMetaItem}>
                          <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.reportsList}
            />
          )}
        </View>
      )}
      
      {/* İstatistikler Sekmesi */}
      {currentTab === 'stats' && (
        <ScrollView style={styles.statsContainer}>
          <View style={[styles.statsSummaryCard, {backgroundColor: theme.card}]}>
            <Text style={[styles.statsSummaryTitle, {color: theme.text}]}>
              Bildirim Özeti
            </Text>
            
            <View style={styles.statsNumbersContainer}>
              <View style={styles.statsNumberBox}>
                <Text style={[styles.statsNumber, {color: theme.primary}]}>
                  {statistics.totalReports}
                </Text>
                <Text style={[styles.statsLabel, {color: theme.textSecondary}]}>
                  Toplam
                </Text>
              </View>
              
              <View style={styles.statsNumberBox}>
                <Text style={[styles.statsNumber, {color: theme.statusColors[ReportStatus.PENDING]}]}>
                  {statistics.pendingReports}
                </Text>
                <Text style={[styles.statsLabel, {color: theme.textSecondary}]}>
                  Bekleyen
                </Text>
              </View>
              
              <View style={styles.statsNumberBox}>
                <Text style={[styles.statsNumber, {color: theme.statusColors[ReportStatus.RESOLVED]}]}>
                  {statistics.resolvedReports}
                </Text>
                <Text style={[styles.statsLabel, {color: theme.textSecondary}]}>
                  Çözüldü
                </Text>
              </View>
            </View>
          </View>
          
          <View style={[styles.statsCard, {backgroundColor: theme.card}]}>
            <Text style={[styles.statsCardTitle, {color: theme.text}]}>
              Bildirimlerin Durumu
            </Text>
            
            {reports.length > 0 ? (
              <View style={styles.statusDistribution}>
                {Object.entries(ReportStatus).map(([key, status]) => {
                  const count = reports.filter(r => r.status === status).length;
                  const percentage = Math.round((count / reports.length) * 100) || 0;
                  
                  return (
                    <View key={key} style={styles.statusItem}>
                      <View style={styles.statusLabelContainer}>
                        <View style={[styles.statusDot, {backgroundColor: theme.statusColors[status]}]} />
                        <Text style={[styles.statusItemLabel, {color: theme.text}]}>{status}</Text>
                      </View>
                      <View style={styles.statusBarContainer}>
                        <View 
                          style={[
                            styles.statusBar, 
                            {
                              backgroundColor: theme.statusColors[status], 
                              width: `${percentage}%`
                            }
                          ]} 
                        />
                        <Text style={[styles.statusPercentage, {color: theme.textSecondary}]}>
                          {percentage}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.emptyStatsText, {color: theme.textSecondary}]}>
                Henüz istatistik verisi bulunmuyor.
              </Text>
            )}
          </View>
          
          <View style={[styles.statsCard, {backgroundColor: theme.card}]}>
            <Text style={[styles.statsCardTitle, {color: theme.text}]}>
              Kategorilere Göre Dağılım
            </Text>
            
            {reports.length > 0 ? (
              <View style={styles.categoryDistribution}>
                {Object.entries(statistics.categoryBreakdown).map(([category, count]) => {
                  const percentage = Math.round((count / reports.length) * 100) || 0;
                  
                  if (count === 0) return null;
                  
                  return (
                    <View key={category} style={styles.categoryItem}>
                      <View style={styles.categoryLabelContainer}>
                        <MaterialIcons 
                          name={
                            category === ReportCategory.INFRASTRUCTURE ? "construction" :
                            category === ReportCategory.ENVIRONMENT ? "nature" :
                            category === ReportCategory.SECURITY ? "security" :
                            category === ReportCategory.TRAFFIC ? "traffic" :
                            category === ReportCategory.WASTE ? "delete" :
                            "help"
                          } 
                          size={16} 
                          color={theme.text} 
                        />
                        <Text style={[styles.categoryItemLabel, {color: theme.text}]}>{category}</Text>
                      </View>
                      <View style={styles.categoryBarContainer}>
                        <View 
                          style={[
                            styles.categoryBar, 
                            {
                              backgroundColor: theme.primary, 
                              width: `${percentage}%`
                            }
                          ]} 
                        />
                        <Text style={[styles.categoryPercentage, {color: theme.textSecondary}]}>
                          {percentage}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.emptyStatsText, {color: theme.textSecondary}]}>
                Henüz istatistik verisi bulunmuyor.
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
// Dosyanın en sonuna şunu ekleyin
const styles = StyleSheet.create({
  // ANA CONTAINER STİLLERİ
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  
  // TAB BAR STİLLERİ
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingVertical: 10,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  
  // YENİ BİLDİRİM FORMU STİLLERİ
  scrollContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsButton: {
    position: 'absolute',
    right: 0,
    padding: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 5,
  },
  userInfoBadge: {
    marginTop: 10,
    borderRadius: 15,
    paddingVertical: 5,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfoText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 5,
  },
  
  // FORM SECTİON STİLLERİ
  formSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  
  // INPUT STİLLERİ
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  queryInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  inputIcon: {
    marginLeft: 12,
    marginTop: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  queryInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
    minHeight: 100,
  },
  
  // KATEGORİ SEÇİCİ STİLLERİ
  categoryContainer: {
    borderRadius: 8,
    marginBottom: 16,
  },
  categoryPicker: {
    height: 50,
    width: '100%',
  },
  
  // KONUM STİLLERİ
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  locationInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  locationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 10,
    flex: 0.48,
  },
  locationButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 14,
  },
  
  // GÖRSEL STİLLERİ
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  imageButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  imageCard: {
    width: '48%',
    margin: '1%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
  
  // SUBMIT BUTTON STİLLERİ
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  submitIcon: {
    marginLeft: 8,
  },
  
  // BAŞARI MESAJI STİLLERİ
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  successBannerText: {
    color: '#ffffff',
    marginLeft: 8,
    fontWeight: '500',
  },
  
  // HARİTA MODAL STİLLERİ
  mapContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  map: {
    width: '100%',
    height: height * 0.6,
  },
  mapAddressContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  mapAddressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  mapAddress: {
    fontSize: 14,
  },
  confirmLocationButton: {
    margin: 16,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  confirmLocationText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // GÖRSEL ÖNİZLEME MODAL STİLLERİ
  imagePreviewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  fullScreenImage: {
    width: width,
    height: height * 0.7,
  },
  
  // MODAL STİLLERİ
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalScrollView: {
    maxHeight: height * 0.6,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalUpdateButton: {
    flex: 0.48,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    flex: 0.48,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modalButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButtonText: {
    fontWeight: '600',
  },
  
  // LOGOUT BUTTON STİLLERİ
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  logoutButtonText: {
    color: '#FF4D4D',
    marginLeft: 8,
    fontWeight: '600',
  },
  
  // BİLDİRİM DETAYI STİLLERİ
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 5,
    width: 80,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  detailSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
  },
  miniMapContainer: {
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 10,
  },
  miniMap: {
    ...StyleSheet.absoluteFillObject,
  },
  imageGallery: {
    flexDirection: 'row',
    marginTop: 10,
  },
  galleryImageContainer: {
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  galleryImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  
  // BİLDİRİM GEÇMİŞİ STİLLERİ
  historyContainer: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  speakButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  reportsList: {
    padding: 16,
  },
  reportCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.22,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportCategoryText: {
    fontSize: 12,
    marginLeft: 5,
  },
  reportStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  reportStatusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  reportText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportDate: {
    fontSize: 12,
  },
  reportMeta: {
    flexDirection: 'row',
  },
  reportMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  reportMetaText: {
    fontSize: 12,
    marginLeft: 3,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateSubText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  
  // İSTATİSTİKLER STİLLERİ
  statsContainer: {
    flex: 1,
    padding: 16,
  },
  statsSummaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  statsSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsNumbersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsNumberBox: {
    alignItems: 'center',
    flex: 1,
  },
  statsNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statsLabel: {
    fontSize: 12,
  },
  statsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  statsCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statusDistribution: {
    marginTop: 10,
  },
  statusItem: {
    marginBottom: 15,
  },
  statusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusItemLabel: {
    fontSize: 14,
  },
  statusBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    backgroundColor: '#f1f3f5',
    borderRadius: 10,
    overflow: 'hidden',
  },
  statusBar: {
    height: '100%',
    borderRadius: 10,
  },
  statusPercentage: {
    position: 'absolute',
    right: 10,
    fontSize: 12,
  },
  categoryDistribution: {
    marginTop: 10,
  },
  categoryItem: {
    marginBottom: 15,
  },
  categoryLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  categoryItemLabel: {
    fontSize: 14,
    marginLeft: 8,
  },
  categoryBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    backgroundColor: '#f1f3f5',
    borderRadius: 10,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: 10,
  },
  categoryPercentage: {
    position: 'absolute',
    right: 10,
    fontSize: 12,
  },
  emptyStatsText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 20,
    marginBottom: 20,
  },
  
  // LOGIN EKRANI STİLLERİ
  loginContainer: {
    flex: 1,
    backgroundColor: '#344955',
  },
  loginKeyboardView: {
    flex: 1,
  },
  loginScrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
  },
  logoSubText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 10,
    textAlign: 'center',
  },
  loginFormContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loginFormTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#344955',
    marginBottom: 20,
    textAlign: 'center',
  },
  loginInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  loginInputIcon: {
    marginLeft: 12,
    marginRight: 5,
  },
  loginInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#343a40',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#344955',
    borderRadius: 8,
    padding: 16,
    marginTop: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 8,
  },
  loginInfo: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 16,
    textAlign: 'center',
  },
  
  // TERCİH ALANI STİLLERİ
  preferenceContainer: {
    marginBottom: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#344955',
    marginBottom: 12,
  },
  radioGroup: {
    marginBottom: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#344955',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioButtonSelected: {
    borderColor: '#344955',
    backgroundColor: '#ffffff',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#344955',
  },
  radioText: {
    fontSize: 16,
    color: '#343a40',
  },
  
  // SWITCH CONTAINER
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: '#343a40',
  },
  otherCategoryContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  otherCategoryInput: {
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    fontSize: 16,
  },
  // styles içine ekleyin
categoryButtonsContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginBottom: 15,
  marginTop: 5,
},
categoryButton: {
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 20,
  margin: 4,
},
categoryButtonText: {
  fontSize: 14,
  fontWeight: '500',
},
});