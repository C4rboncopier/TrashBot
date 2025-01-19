/*
 * Trashbot System
 * Main controller for LCD display and sensors
 */

//================ LIBRARY INCLUDES ================
#include <LCDWIKI_GUI.h> 
#include <LCDWIKI_SPI.h> 
#include <LCDWIKI_TOUCH.h>
#include <qrcode.h>
#include <AES.h>

//================ PIN DEFINITIONS ================
// LCD pins
#define MODEL ILI9488_18
#define CS   A15    
#define CD   A13
#define RST  A14
#define MOSI  51
#define MISO  50
#define SCK   52
#define LED  A12

// Touch screen pins
#define TCS   45
#define TCLK  46
#define TDOUT 47
#define TDIN  48
#define TIRQ  49

// Sensor pins
#define TRIG_PIN_1 8
#define ECHO_PIN_1 9
#define TRIG_PIN_2 10
#define ECHO_PIN_2 11
#define IR_SENSOR_PIN 6
#define CAP_SENSOR_PIN 7

//================ DISPLAY CONFIGURATION ================
// Color definitions - Nature themed
#define BLACK   0x0000
#define WHITE   0xFFFF
#define FOREST_GREEN 0x2444    // Dark green for background
#define LEAF_GREEN  0x07E0     // Bright green for buttons
#define WOOD_BROWN  0xBBCA     // Brown color for accents
#define SKY_BLUE    0x867D     // Light blue
#define EARTH_BROWN 0x9B40     // Darker brown

// Screen dimensions and text settings
#define SCREEN_WIDTH 480
#define SCREEN_HEIGHT 320
#define CHAR_WIDTH 16          // Width of each character in pixels for text size 3
#define SMALL_CHAR_WIDTH 12    // Width of each character in pixels for text size 2
#define STATUS_HEIGHT 40       // Height of the status text area

// Button dimensions
#define BUTTON_X (SCREEN_WIDTH / 2 - 100)
#define BUTTON_Y (SCREEN_HEIGHT - 70)
#define BUTTON_WIDTH 200
#define BUTTON_HEIGHT 50

//================ GLOBAL VARIABLES ================
// Display objects
LCDWIKI_SPI my_lcd(MODEL, CS, CD, MISO, MOSI, RST, SCK, LED);
LCDWIKI_TOUCH my_touch(TCS,TCLK,TDOUT,TDIN,TIRQ);

// System state variables
String previousText = "";
const int NUM_READINGS = 5;
long distanceReadings1[NUM_READINGS];
int currentReadingIndex1 = 0;
int points = 0;
bool buttonPressed = false;
bool objectPresent = false;
bool systemReady = true;

// Timing variables
unsigned long lastTouchTime = 0;
unsigned long lastObjectRemovalTime = 0;
const unsigned long TOUCH_DEBOUNCE = 300;    // Debounce time in milliseconds
const unsigned long SYSTEM_COOLDOWN = 2000;  // 2 second cooldown

// Encryption variables
const char encryptionKey[] = "TRASHBOTSECRETKEY";  // 16-byte key
const char hexArray[] = "0123456789ABCDEF";

// Add new timing variable for sensor delay
const unsigned long SENSOR_DELAY = 500;  // 0.5 seconds delay for sensor stabilization

// Add variables for capacitive sensor readings
const int CAP_SAMPLES = 10;  // Number of samples to take
const int CAP_THRESHOLD = 6; // Number of HIGH readings needed to confirm metal
int capReadings[CAP_SAMPLES];  // Array to store readings

// Function prototype
void updateText(String newText, int y, bool isStatus = false);

//================ SETUP & MAIN LOOP ================
void setup() {
    Serial.begin(9600);
    
    // Initialize pins
    pinMode(TRIG_PIN_1, OUTPUT);
    pinMode(ECHO_PIN_1, INPUT);
    pinMode(TRIG_PIN_2, OUTPUT);
    pinMode(ECHO_PIN_2, INPUT);
    pinMode(IR_SENSOR_PIN, INPUT);
    pinMode(CAP_SENSOR_PIN, INPUT);
    
    // Initialize LCD
    my_lcd.Init_LCD();
    my_lcd.Set_Rotation(1);
    
    // Initialize touch
    my_touch.TP_Init(my_lcd.Get_Rotation(), my_lcd.Get_Display_Width(), my_lcd.Get_Display_Height());
    my_touch.TP_Set_Rotation(1);
    
    // Initial screen setup
    initializeScreen();
}

void loop() {
    handleTouch();
    handleSensors();
    delay(50);
}

//================ DISPLAY FUNCTIONS ================
void initializeScreen() {
    my_lcd.Fill_Screen(FOREST_GREEN);
    
    my_lcd.Set_Text_Mode(0);
    my_lcd.Set_Text_Size(3);
    my_lcd.Set_Text_colour(WHITE);
    my_lcd.Set_Text_Back_colour(FOREST_GREEN);
    
    // Draw a decorative header bar
    my_lcd.Set_Draw_color(WOOD_BROWN);
    my_lcd.Fill_Rectangle(0, 0, SCREEN_WIDTH, 30);
    
    // Title centered at 40px from top
    updateText("Trash Bot", 40);
    // Status centered at 140px from top
    updateText("Ready to Scan", 140, true);
    displayPoints();
    drawButton();
}

void updateText(String newText, int y, bool isStatus = false) {
    // Calculate exact center position
    int textWidth = newText.length() * CHAR_WIDTH;  // For text size 3
    int centerX = ((SCREEN_WIDTH - textWidth) / 2) - 15;
    
    if (isStatus) {
        // Clear status area with background color
        my_lcd.Fill_Rect(0, y - 5, SCREEN_WIDTH, STATUS_HEIGHT + 10, FOREST_GREEN);
        my_lcd.Print_String(newText.c_str(), centerX, y);
    } else {
        // For title text
        my_lcd.Fill_Rect(0, y - 5, SCREEN_WIDTH, STATUS_HEIGHT, FOREST_GREEN);
        my_lcd.Print_String(newText.c_str(), centerX, y);
    }
    previousText = newText;
}

void displayPoints() {
    my_lcd.Set_Text_Size(2);
    // Remove the background fill for points
    my_lcd.Set_Text_Back_colour(WOOD_BROWN);  // Make text background match main background
    my_lcd.Set_Text_colour(WHITE);
    my_lcd.Print_String(("Points: " + String(points)).c_str(), 15, 10);
    my_lcd.Set_Text_Size(3);
}

void drawButton() {
    // Center the button horizontally
    int buttonX = (SCREEN_WIDTH - BUTTON_WIDTH) / 2;
    
    // Draw button background with leaf green color
    my_lcd.Set_Draw_color(LEAF_GREEN);
    my_lcd.Fill_Round_Rectangle(buttonX, BUTTON_Y, buttonX + BUTTON_WIDTH, BUTTON_Y + BUTTON_HEIGHT, 8);
    
    // Add a subtle border
    my_lcd.Set_Draw_color(WOOD_BROWN);
    my_lcd.Draw_Round_Rectangle(buttonX, BUTTON_Y, buttonX + BUTTON_WIDTH, BUTTON_Y + BUTTON_HEIGHT, 8);
    
    // Center the text in the button with transparent background
    my_lcd.Set_Text_Back_colour(LEAF_GREEN);  // Match button color for transparency
    my_lcd.Set_Text_colour(WHITE);
    my_lcd.Set_Text_Size(2);
    
    // Calculate exact center position for text
    String buttonText = "Generate QR";
    int textWidth = buttonText.length() * SMALL_CHAR_WIDTH;
    int textX = buttonX + (BUTTON_WIDTH - textWidth) / 2;
    my_lcd.Print_String(buttonText.c_str(), textX, BUTTON_Y + 15);
    
    my_lcd.Set_Text_Size(3);
    my_lcd.Set_Text_Back_colour(FOREST_GREEN);  // Reset to default background
}

void drawDoneButton() {
    // Button dimensions
    const int doneButtonWidth = 120;
    const int doneButtonHeight = 40;
    
    // Center the button horizontally
    int doneButtonX = (SCREEN_WIDTH - doneButtonWidth) / 2;
    int doneButtonY = SCREEN_HEIGHT - 60;  // 60 pixels from bottom
    
    // Main button in leaf green
    my_lcd.Set_Draw_color(LEAF_GREEN);
    my_lcd.Fill_Round_Rectangle(doneButtonX, doneButtonY, doneButtonX + doneButtonWidth, doneButtonY + doneButtonHeight, 8);
    
    // Add brown border for depth
    my_lcd.Set_Draw_color(WOOD_BROWN);
    my_lcd.Draw_Round_Rectangle(doneButtonX, doneButtonY, doneButtonX + doneButtonWidth, doneButtonY + doneButtonHeight, 8);
    
    // Center the text with background matching button color
    my_lcd.Set_Text_Back_colour(LEAF_GREEN);  // Set text background to match button
    my_lcd.Set_Text_colour(WHITE);
    my_lcd.Set_Text_Size(2);
    String doneText = "DONE";
    int textWidth = doneText.length() * SMALL_CHAR_WIDTH;
    int textX = doneButtonX + (doneButtonWidth - textWidth) / 2;
    my_lcd.Print_String(doneText.c_str(), textX, doneButtonY + 12);
    
    // Reset text background color to default
    my_lcd.Set_Text_Back_colour(WHITE);  // Reset to white since we're on QR code screen
}

bool isDoneButtonPressed(uint16_t x, uint16_t y) {
    const int doneButtonWidth = 120;
    const int doneButtonHeight = 40;
    int doneButtonX = (SCREEN_WIDTH - doneButtonWidth) / 2;
    int doneButtonY = SCREEN_HEIGHT - 60;
    
    return (x >= doneButtonX && x <= (doneButtonX + doneButtonWidth) &&
            y >= doneButtonY && y <= (doneButtonY + doneButtonHeight));
}

String bytesToHex(byte* bytes, int length) {
    String result = "";
    for (int i = 0; i < length; i++) {
        result += hexArray[bytes[i] >> 4];
        result += hexArray[bytes[i] & 0x0F];
    }
    return result;
}

String encryptData(String data) {
    // Add a timestamp to make each QR code unique
    String uniqueData = data + "|" + String(millis());
    
    String encrypted = "";
    int keyLength = strlen(encryptionKey);
    
    // Convert to hex with simple XOR encryption
    for (int i = 0; i < uniqueData.length(); i++) {
        char encryptedChar = uniqueData.charAt(i) ^ encryptionKey[i % keyLength];
        char hex[3];
        sprintf(hex, "%02X", encryptedChar);
        encrypted += hex;
    }
    
    return encrypted;
}

void generateQRCode(int currentPoints) {
    my_lcd.Fill_Screen(WHITE);  // Keep white background for QR code clarity

    QRCode qrcode;
    const int qr_version = 4;
    const int qr_size = 4 * qr_version + 17;
    uint8_t qrcodeData[qr_size * qr_size];

    String data = "Points:" + String(currentPoints);
    String encryptedData = encryptData(data);

    qrcode_initText(&qrcode, qrcodeData, qr_version, ECC_LOW, encryptedData.c_str());

    const int scale = 4;
    const int offset_x = (SCREEN_WIDTH - qrcode.size * scale) / 2;
    const int offset_y = (SCREEN_HEIGHT - qrcode.size * scale) / 2 - 20; // Moved up slightly to make room for button

    // Draw a nature-themed frame around the QR code
    my_lcd.Set_Draw_color(FOREST_GREEN);
    my_lcd.Draw_Rectangle(offset_x - 10, offset_y - 10, 
                         offset_x + qrcode.size * scale + 10, 
                         offset_y + qrcode.size * scale + 10);
    
    // Draw QR Code
    for (int y = 0; y < qrcode.size; y++) {
        for (int x = 0; x < qrcode.size; x++) {
            if (qrcode_getModule(&qrcode, x, y)) {
                my_lcd.Fill_Rect(
                    offset_x + x * scale,
                    offset_y + y * scale,
                    scale,
                    scale,
                    BLACK
                );
            }
        }
    }

    // Draw the Done button
    drawDoneButton();

    // Timer for automatic return (10 seconds)
    unsigned long startTime = millis();
    bool isDone = false;

    while (!isDone && (millis() - startTime < 10000)) { // 10 seconds timeout
        if (my_touch.TP_Scan(0)) {
            uint16_t x = my_touch.x;
            uint16_t y = my_touch.y;
            
            if (isDoneButtonPressed(x, y)) {
                isDone = true;
            }
        }
        delay(10); // Small delay to prevent excessive CPU usage
    }

    // Reset points and update display
    points = 0;
    
    // Quick screen reset
    my_lcd.Fill_Screen(FOREST_GREEN);
    
    // Redraw main screen elements efficiently
    my_lcd.Set_Text_Mode(0);
    my_lcd.Set_Text_Size(3);
    my_lcd.Set_Text_colour(WHITE);
    my_lcd.Set_Text_Back_colour(FOREST_GREEN);
    
    // Draw header bar
    my_lcd.Set_Draw_color(WOOD_BROWN);
    my_lcd.Fill_Rectangle(0, 0, SCREEN_WIDTH, 30);
    
    // Draw all elements without delays
    updateText("Trash Bot", 40);
    updateText("Ready to Scan", 140, true);
    displayPoints();
    drawButton();
}

//================ TOUCH HANDLING ================
void handleTouch() {
    uint16_t x, y;
    if (my_touch.TP_Scan(0)) {
        if (millis() - lastTouchTime > TOUCH_DEBOUNCE) {
            x = my_touch.x;
            y = my_touch.y;
            
            // Calculate button position
            int buttonX = (SCREEN_WIDTH - BUTTON_WIDTH) / 2;
            
            // Check if touch is within button bounds
            if (x >= buttonX && x <= (buttonX + BUTTON_WIDTH) &&
                y >= BUTTON_Y && y <= (BUTTON_Y + BUTTON_HEIGHT)) {
                buttonPressed = true;
                lastTouchTime = millis();
                
                // Check if points are 0
                if (points == 0) {
                    // Show error message
                    updateText("No points to generate QR!", 140, true);
                    delay(2000);  // Show error for 2 seconds
                    updateText("Ready to Scan", 140, true);
                } else {
                    generateQRCode(points);
                }
            }
        }
    }
}

//================ SENSOR FUNCTIONS ================
bool checkCapacitiveSensor() {
    int highReadings = 0;
    
    // Take multiple samples
    for(int i = 0; i < CAP_SAMPLES; i++) {
        capReadings[i] = digitalRead(CAP_SENSOR_PIN);
        if(capReadings[i] == HIGH) {
            highReadings++;
        }
        delayMicroseconds(100); // Small delay between readings
    }
    
    // Return true if we have enough HIGH readings
    return (highReadings >= CAP_THRESHOLD);
}

void handleSensors() {
    if (!systemReady) {
        if (millis() - lastObjectRemovalTime >= SYSTEM_COOLDOWN) {
            systemReady = true;
            updateText("Ready to Scan", 140, true);
        }
        return;
    }

    long distance1 = measureDistance(TRIG_PIN_1, ECHO_PIN_1);
    
    // Update rolling average
    distanceReadings1[currentReadingIndex1] = distance1;
    currentReadingIndex1 = (currentReadingIndex1 + 1) % NUM_READINGS;
    
    long averageDistance1 = calculateAverageDistance();
    
    if (averageDistance1 <= 7.62) { // 3 inches
        if (!objectPresent) {
            objectPresent = true;
            updateText("Object Detected...", 140, true);
            
            // Add delay for sensor stabilization
            delay(SENSOR_DELAY);
            
            // After delay, take measurements
            long distance2 = measureDistance(TRIG_PIN_2, ECHO_PIN_2);
            bool irDetected = digitalRead(IR_SENSOR_PIN) == HIGH;
            bool capDetected = checkCapacitiveSensor();  // Use new function for better detection
            
            processDetection(distance2, irDetected, capDetected);
        }
    } else {
        if (objectPresent) {
            objectPresent = false;
            systemReady = false;
            lastObjectRemovalTime = millis();
            updateText("Please Wait...", 140, true);
        }
    }
}

long measureDistance(int trigPin, int echoPin) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    
    long duration = pulseIn(echoPin, HIGH);
    return duration * 0.034 / 2;
}

long calculateAverageDistance() {
    long sum = 0;
    for (int i = 0; i < NUM_READINGS; i++) {
        sum += distanceReadings1[i];
    }
    return sum / NUM_READINGS;
}

void processDetection(long distance2, bool irDetected, bool capDetected) {
    // Set text background color to match main background
    my_lcd.Set_Text_Back_colour(FOREST_GREEN);
    
    if (capDetected) {
        // Metal detected with improved sensitivity
        updateText("Metal detected!", 140, true);
    } else if (irDetected) {
        // Plastic detection logic
        if (distance2 >= 5.08) {
            updateText("Unusable Plastic", 140, true);
            points += 5;
        } else {
            updateText("Usable Plastic", 140, true);
            points += 5;
        }
    } else {
        updateText("Non-Plastic!", 140, true);
    }
    
    // Save current text background color
    my_lcd.Set_Text_Back_colour(WOOD_BROWN);
    displayPoints();
    // Reset text background color
    my_lcd.Set_Text_Back_colour(FOREST_GREEN);
    
    delay(2000);
}
