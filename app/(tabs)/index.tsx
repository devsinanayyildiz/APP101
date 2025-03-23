import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Image,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import uuid from 'react-native-uuid';
import { Ionicons } from '@expo/vector-icons';

export default function App() {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [images, setImages] = useState([]);
  const [location, setLocation] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Gerekli izinleri al ve metadata topla
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
        if (locationStatus !== 'granted') {
          Alert.alert('Bilgi', 'Konum izni reddedildi. Bazı özellikler sınırlı olabilir.');
        } else {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation(loc.coords);
        }

        setDeviceInfo({
          model: Device.modelName || 'Bilinmiyor',
          osVersion: Device.osVersion || 'Bilinmiyor',
          deviceId: Device.osInternalBuildId || 'Bilinmiyor'
        });
      } catch (error) {
        console.log('İzin hatası:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Resim seçimi veya çekimi
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
          exif: true
        });
        if (!result.canceled) {
          addImageToState(result);
        }
      }
    } catch (error) {
      Alert.alert('Hata', 'Görsel seçilirken bir hata oluştu.');
    }
  };

  const addImageToState = (result) => {
    // Expo SDK 47+ için uyumlu şekilde güncellendi
    const assets = result.assets ? result.assets : [result];

    const newImages = assets.map(asset => ({
      image_id: uuid.v4(),
      filename: asset.uri.split('/').pop(),
      image_base64: asset.base64,
      uri: asset.uri,
      metadata: {
        latitude: location ? location.latitude : null,
        longitude: location ? location.longitude : null,
        timestamp: new Date().toISOString(),
        device: deviceInfo.model || 'Bilinmiyor',
        os_version: deviceInfo.osVersion || 'Bilinmiyor',
        address: manualAddress || 'Bilinmiyor',
      }
    }));

    setImages([...images, ...newImages]);
  };

  const removeImage = (imageId) => {
    setImages(images.filter(img => img.image_id !== imageId));
  };

  // Form doğrulama
  const validateForm = () => {
    if (!query.trim()) {
      Alert.alert('Uyarı', 'Lütfen sorununuzu/talebinizi girin.');
      return false;
    }

    // E-posta ve telefon kontrolü sadece eğer kullanıcı girdi sağlamışsa
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Uyarı', 'Geçerli bir e-posta adresi girin.');
      return false;
    }

    if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) {
      Alert.alert('Uyarı', 'Geçerli bir telefon numarası girin (örn: +37012345678).');
      return false;
    }

    return true;
  };

  // JSON payload oluşturma ve konsola loglama
  const handleSubmit = () => {
    if (!validateForm()) return;

    setIsLoading(true);

    // Dokümandaki formata uygun JSON payload oluştur
    const payload = {
      uuid: uuid.v4(),
      query: query,
      images: images.map(img => ({
        image_id: img.image_id,
        filename: img.filename,
        image_base64: img.image_base64, // Base64 verisini olduğu gibi gönder
        metadata: {
          latitude: img.metadata.latitude,
          longitude: img.metadata.longitude,
          timestamp: img.metadata.timestamp,
          device: img.metadata.device,
          os_version: img.metadata.os_version,
          address: img.metadata.address
        }
      })),
      user_info: {
        name: name,
        surname: surname,
        email: email,
        phone_number: phone,
        manual_address: manualAddress,
      },
      submission_metadata: {
        submission_time: new Date().toISOString(),
        app_version: '1.0.0',
        device_id: deviceInfo.deviceId
      }
    };

    // API bağlantısı olmadığı için sadece loglama yap
    console.log("JSON Payload:", JSON.stringify(payload, null, 2));

    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
          "Bilgilendirme",
          "Veriler konsola loglandı. API entegrasyonu yapıldığında bu veriler sunucuya gönderilecektir.",
          [{ text: "Tamam", onPress: () => clearForm() }]
      );
    }, 1000);
  };

  const clearForm = () => {
    setQuery('');
    setImages([]);
    // İsteğe bağlı olarak diğer alanları da temizleyebilirsiniz
    // setName('');
    // setSurname('');
    // setEmail('');
    // setPhone('');
    // setManualAddress('');
  };

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

  return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

        {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4A6572" />
              <Text style={styles.loadingText}>İşleminiz gerçekleştiriliyor...</Text>
            </View>
        )}

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Bildirim Formu</Text>
            <Text style={styles.headerSubtitle}>Sorununuzu bildirin, biz ilgilenelim.</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Sorununuz</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="chatbubble-outline" size={20} color="#4A6572" style={styles.inputIcon} />
              <TextInput
                  placeholder="Örneğin: Sokak lambası arızalı"
                  value={query}
                  onChangeText={setQuery}
                  style={styles.input}
                  placeholderTextColor="#adb5bd"
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
            <Text style={styles.sectionSubtitle}>Sizinle iletişime geçebilmemiz için</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#4A6572" style={styles.inputIcon} />
              <TextInput
                  placeholder="Adınız"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholderTextColor="#adb5bd"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#4A6572" style={styles.inputIcon} />
              <TextInput
                  placeholder="Soyadınız"
                  value={surname}
                  onChangeText={setSurname}
                  style={styles.input}
                  placeholderTextColor="#adb5bd"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#4A6572" style={styles.inputIcon} />
              <TextInput
                  placeholder="email@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  style={styles.input}
                  placeholderTextColor="#adb5bd"
                  autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#4A6572" style={styles.inputIcon} />
              <TextInput
                  placeholder="+37012345678"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  style={styles.input}
                  placeholderTextColor="#adb5bd"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color="#4A6572" style={styles.inputIcon} />
              <TextInput
                  placeholder="Örn: Main Street 123, Vilnius"
                  value={manualAddress}
                  onChangeText={setManualAddress}
                  style={styles.input}
                  placeholderTextColor="#adb5bd"
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Görseller</Text>
            <Text style={styles.sectionSubtitle}>Durumu daha iyi anlamamız için görsel ekleyebilirsiniz</Text>

            <TouchableOpacity
                style={styles.imageButton}
                onPress={showImageOptions}
            >
              <Ionicons name="camera-outline" size={24} color="#ffffff" />
              <Text style={styles.imageButtonText}>Görsel Ekle</Text>
            </TouchableOpacity>

            {images.length > 0 && (
                <View style={styles.imagesContainer}>
                  {images.map((img) => (
                      <View key={img.image_id} style={styles.imageCard}>
                        <Image
                            source={{ uri: img.image_base64 ? `data:image/jpeg;base64,${img.image_base64}` : img.uri }}
                            style={styles.imagePreview}
                        />
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
              style={styles.submitButton}
              onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>Gönder</Text>
            <Ionicons name="paper-plane-outline" size={20} color="#ffffff" style={styles.submitIcon} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#344955',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#4A6572',
    marginTop: 5,
  },
  formSection: {
    backgroundColor: '#ffffff',
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
    color: '#344955',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#4A6572',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#343a40',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6572',
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#344955',
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
  loadingText: {
    marginTop: 12,
    color: '#4A6572',
    fontSize: 16,
  },
});