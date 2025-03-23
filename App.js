import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Image, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import uuid from 'react-native-uuid';

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

  // Gerekli izinleri al ve metadata topla
  useEffect(() => {
    (async () => {
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        Alert.alert('Konum izni reddedildi!');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);

      setDeviceInfo({
        model: Device.modelName,
        osVersion: Device.osVersion,
      });
    })();
  }, []);

  // Resim seçimi veya çekimi
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Galeri izni reddedildi!');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.7,
    });
    if (!result.cancelled) {
      setImages([
        ...images,
        {
          image_id: uuid.v4(),
          filename: result.uri.split('/').pop(),
          image_base64: result.base64,
          metadata: {
            latitude: location ? location.latitude : null,
            longitude: location ? location.longitude : null,
            timestamp: new Date().toISOString(),
            device: deviceInfo.model || 'Bilinmiyor',
            os_version: deviceInfo.osVersion || 'Bilinmiyor',
            address: manualAddress || 'Bilinmiyor',
          },
        },
      ]);
    }
  };

  // JSON payload oluşturma ve konsola loglama (API endpoint henüz geliştirilmedi)
  const handleSubmit = () => {
    if (!query.trim()) {
      Alert.alert('Lütfen sorgunuzu girin.');
      return;
    }
    const payload = {
      uuid: uuid.v4(),
      query: query,
      images: images,
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
        device_id: Device.osInternalBuildId || 'Bilinmiyor',
      },
    };

    console.log("Gönderilecek Payload:", payload);
    Alert.alert("Veriler loglandı. Konsolu kontrol ediniz.");
  };

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text>Sorgu:</Text>
      <TextInput
        placeholder="Örneğin: Sokak lambası arızalı"
        value={query}
        onChangeText={setQuery}
        style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
      />

      <Text>İsim:</Text>
      <TextInput
        placeholder="Adınız"
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
      />

      <Text>Soyisim:</Text>
      <TextInput
        placeholder="Soyadınız"
        value={surname}
        onChangeText={setSurname}
        style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
      />

      <Text>Email:</Text>
      <TextInput
        placeholder="email@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
      />

      <Text>Telefon Numarası:</Text>
      <TextInput
        placeholder="+37012345678"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
      />

      <Text>Manuel Adres (Opsiyonel):</Text>
      <TextInput
        placeholder="Örn: Main Street 123, Vilnius"
        value={manualAddress}
        onChangeText={setManualAddress}
        style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
      />

      <Button title="Resim Seç / Çek" onPress={pickImage} />
      {images.map((img, index) => (
        <View key={index} style={{ marginTop: 10 }}>
          <Text>{img.filename}</Text>
          <Image
            source={{ uri: img.image_base64 ? `data:image/jpeg;base64,${img.image_base64}` : img.uri }}
            style={{ width: 200, height: 200 }}
          />
        </View>
      ))}

      <Button title="Gönder" onPress={handleSubmit} style={{ marginTop: 20 }} />
    </ScrollView>
  );
}
