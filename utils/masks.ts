
/**
 * Utility to apply masks to various field types
 */
export const MaskService = {
  /**
   * Masks CPF (000.000.000-00) or CNPJ (00.000.000/0000-00) dynamically
   */
  maskCpfCnpj: (value: string): string => {
    const digits = value.replace(/\D/g, "");
    
    // Limits to max CNPJ length
    const limited = digits.slice(0, 14);
    
    if (limited.length <= 11) {
      // CPF
      return limited
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ
      return limited
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
  },

  /**
   * Only allows digits
   */
  onlyDigits: (value: string): string => {
    return value.replace(/\D/g, "");
  }
};
