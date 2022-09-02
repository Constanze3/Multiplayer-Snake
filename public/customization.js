
const customizationMenu = document.getElementsByClassName("customization-menu");
const customizationButtons = document.getElementsByClassName("customization-option-button");
let selectedCustomizationButton;

const colorPicker = new iro.ColorPicker('#color-picker', {
    width: 200,
    color: "rgb(255, 0, 0)",
    borderWidth: 1,
    borderColor: "#fff",
    layout: [
        {
            component: iro.ui.Box,
            options: {}
        },
        {
            component: iro.ui.Slider,
            options: {
                sliderType: 'hue'
            }
        }
    ]
});

colorPicker.on('color:change', function (color) {
    if (selectedCustomizationButton != null) {
        selectedCustomizationButton.style.backgroundColor = color.hexString;
        selectedCustomizationButton.style.setProperty("--dark-border", color.hexString);
        setButtonLightOrDark(selectedCustomizationButton, color.rgb);
    }
});

function customizationButtonClick(buttonId) {
    let clickedButton = document.getElementById(buttonId);
    customizationButtons.forEach(button => {
        button.classList.remove("selected");
    });
    clickedButton.classList.add("selected");
    selectedCustomizationButton = clickedButton;
}

function setButtonLightOrDark(button, color) {
    let luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    if (luminance < 128) {
        button.classList.remove("light");
        button.classList.add("dark");
    }
    else {
        button.classList.remove("dark");
        button.classList.add("light");
    }
}

function showCustomizationMenu() {
    customizationMenu.forEach(element => {
        element.style.display = "block";
    });
}

function hideCustomizationMenu() {
    selectedCustomizationButton = null;
    customizationButtons.forEach(button => {
        button.classList.remove("selected");
    });
    customizationMenu.forEach(element => {
        element.style.display = "none";
    });
}